/**
 * AlgoPay Oracle — core signing module
 *
 * Web3 payment oracle. Works with any fiat payment provider
 * (Razorpay, Stripe, PayU, CCAvenue) — provider-specific adapters
 * live in index.js, this module stays provider-agnostic.
 */

const algosdk = require("algosdk");

const PROOF_PREFIX = "AlgoPay:v1:";

class AlgoPayOracle {
  constructor(mnemonic, algodClient, appId = null) {
    this.account = algosdk.mnemonicToSecretKey(mnemonic);
    this.address = this.account.addr.toString();
    this.algod   = algodClient;
    this.appId   = appId;
  }

  /**
   * Sign a verified payment proof.
   *
   * Byte packing (must match AlgoPayOracle.py verify_payment exactly):
   * MX  +  AlgoPay:v1:  +  payment_id  +  action  +  currency  +  amount(8B BE)  +  timestamp(8B BE)
   *
   * "MX" is prepended by algosdk.signBytes automatically.
   * The contract prepends it manually before ed25519verify_bare.
   *
   * timestamp is now included in the signature — prevents stale proofs
   * from being submitted more than 5 minutes after the oracle signed them.
   */
  signProof(payload) {
    const { payment_id, amount, action = "unlock", currency = "INR" } = payload;

    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw new Error("amount must be a positive integer");
    }

    // unix seconds — contract checks latest_timestamp - timestamp < 300
    const timestamp = Math.floor(Date.now() / 1000) - 20;

    const prefixBytes    = new TextEncoder().encode(PROOF_PREFIX);
    const pidBytes       = new TextEncoder().encode(payment_id);
    const actionBytes    = new TextEncoder().encode(action);
    const currencyBytes  = new TextEncoder().encode(currency.toUpperCase());
    const amountBytes    = algosdk.encodeUint64(amount);
    const timestampBytes = algosdk.encodeUint64(timestamp);

    const message = new Uint8Array(
      prefixBytes.length + pidBytes.length + actionBytes.length +
      currencyBytes.length + amountBytes.length + timestampBytes.length
    );

    let off = 0;
    message.set(prefixBytes,    off); off += prefixBytes.length;
    message.set(pidBytes,       off); off += pidBytes.length;
    message.set(actionBytes,    off); off += actionBytes.length;
    message.set(currencyBytes,  off); off += currencyBytes.length;
    message.set(amountBytes,    off); off += amountBytes.length;
    message.set(timestampBytes, off);

    const sigBytes = algosdk.signBytes(message, this.account.sk);

    return {
      payment_id,
      amount,
      action,
      currency:       currency.toUpperCase(),
      timestamp,                                          // unix seconds
      oracle_address: this.address,
      signature:      Buffer.from(sigBytes).toString("base64"),
    };
  }

  /**
   * Submit a signed proof to Algorand.
   *
   * Contract mode (appId set):
   * ATC group: nop + nop + nop + verify_payment
   * nop calls pool opcode budget for ed25519verify_bare (1900 cost)
   */
  async submitProof(signedProof) {
    const params = await this.algod.getTransactionParams().do();
    params.flatFee = true;
    params.fee     = Math.max(Number(params.minFee ?? 1000), 1000) * 5;

    const note = new TextEncoder().encode(JSON.stringify(signedProof));

    if (this.appId) {
      const verifyMethod = new algosdk.ABIMethod({
        name: "verify_payment",
        args: [
          { name: "payment_id", type: "string" },
          { name: "action",     type: "string" },
          { name: "amount",     type: "uint64" },
          { name: "currency",   type: "string" },
          { name: "timestamp",  type: "uint64" },
          { name: "signature",  type: "byte[]" },
        ],
        returns: { type: "bool" },
      });

      const nopMethod = new algosdk.ABIMethod({
        name: "nop", args: [], returns: { type: "void" },
      });

      const signer = algosdk.makeBasicAccountTransactionSigner(this.account);
      const atc    = new algosdk.AtomicTransactionComposer();

      // Loop to add 3 nop calls (Pools 3 * 700 = 2100 extra budget)
      for (let i = 1; i <= 3; i++) {
        atc.addMethodCall({
          appID: this.appId, 
          method: nopMethod, 
          methodArgs: [],
          sender: this.address, 
          suggestedParams: params,
          note: new TextEncoder().encode(`pad${i}`), 
          signer,
        });
      }

      atc.addMethodCall({
        appID:      this.appId,
        method:     verifyMethod,
        methodArgs: [
          signedProof.payment_id,
          signedProof.action,
          signedProof.amount,
          signedProof.currency,
          signedProof.timestamp,
          Buffer.from(signedProof.signature, "base64"),
        ],
        boxes: [
          { appIndex: 0, name: new TextEncoder().encode(signedProof.payment_id) },
        ],
        sender: this.address, suggestedParams: params, note, signer,
      });

      const result = await atc.execute(this.algod, 6);
      return result.txIDs[3];   

    } else {
      const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: this.address, receiver: this.address, amount: 0,
        note, suggestedParams: params,
      });
      const signed = txn.signTxn(this.account.sk);
      const { txid } = await this.algod.sendRawTransaction(signed).do();
      await algosdk.waitForConfirmation(this.algod, txid, 6);
      return txid;
    }
  }

  /**
   * Verify a proof by looking up its transaction on the indexer.
   * Used by GET /verify-proof/:txId
   */
  static async verifyProofTxn(txId, indexerClient) {
    const info = await indexerClient.lookupTransactionByID(txId).do();
    const txn  = info.transaction;
    if (!txn?.note) return { valid: false, reason: "transaction not found or no note" };

    let proof;
    try {
      proof = JSON.parse(Buffer.from(txn.note, "base64").toString("utf8"));
    } catch {
      return { valid: false, reason: "note is not valid JSON" };
    }

    const required = ["signature", "oracle_address", "payment_id", "action", "amount", "timestamp"];
    for (const f of required) {
      if (proof[f] == null) return { valid: false, reason: `missing field: ${f}` };
    }

    const prefixBytes    = new TextEncoder().encode(PROOF_PREFIX);
    const pidBytes       = new TextEncoder().encode(proof.payment_id);
    const actionBytes    = new TextEncoder().encode(proof.action);
    const currencyBytes  = new TextEncoder().encode((proof.currency || "INR").toUpperCase());
    const amountBytes    = algosdk.encodeUint64(proof.amount);
    const timestampBytes = algosdk.encodeUint64(proof.timestamp);

    const message = new Uint8Array(
      prefixBytes.length + pidBytes.length + actionBytes.length +
      currencyBytes.length + amountBytes.length + timestampBytes.length
    );

    let off = 0;
    message.set(prefixBytes,    off); off += prefixBytes.length;
    message.set(pidBytes,       off); off += pidBytes.length;
    message.set(actionBytes,    off); off += actionBytes.length;
    message.set(currencyBytes,  off); off += currencyBytes.length;
    message.set(amountBytes,    off); off += amountBytes.length;
    message.set(timestampBytes, off);

    // FIX 1: V8 Context Isolation
    // Grab the exact Uint8Array constructor from the algosdk VM context to satisfy TweetNaCl
    const SDK_Uint8Array = algosdk.decodeAddress(proof.oracle_address).publicKey.constructor;
    
    const sigBuffer = Buffer.from(proof.signature, "base64");
    const sigBytes  = new SDK_Uint8Array(sigBuffer);
    const msgBytes  = new SDK_Uint8Array(message);

    // FIX 2: API Signature Correction
    // algosdk.verifyBytes expects the STRING address, NOT the decoded public key byte array
    const isValid = algosdk.verifyBytes(msgBytes, sigBytes, proof.oracle_address);

    return isValid
      ? { valid: true, proof }
      : { valid: false, reason: "signature verification failed" };
  }

  getPublicKeyBase64() {
    return Buffer.from(algosdk.decodeAddress(this.address).publicKey).toString("base64");
  }
}

module.exports = { AlgoPayOracle };