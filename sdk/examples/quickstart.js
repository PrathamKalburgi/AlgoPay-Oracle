/**
 * @algopayoracle/oracle-sdk — Quickstart
 *
 * Demonstrates anchor mode (no contract needed).
 * A real payment proof is signed and anchored on Algorand TestNet.
 *
 * Run:
 *   ORACLE_MNEMONIC="your 25 words" node examples/quickstart.js
 */

require("dotenv").config();
const { AlgoPayClient, OracleSigner } = require("../src");

async function main() {
  const mnemonic = process.env.ORACLE_MNEMONIC;
  if (!mnemonic) {
    console.error("Set ORACLE_MNEMONIC in your environment or .env file");
    process.exit(1);
  }

  // ── 1. Inspect oracle identity ─────────────────────────────────────────
  const signer = new OracleSigner(mnemonic);
  console.log("\n🔑 Oracle address  :", signer.getAddress());
  console.log("📦 Oracle pubkey   :", signer.getPublicKeyBase64());
  console.log("   (paste this into AlgoPayOracle.py create() call)\n");

  // ── 2. Create client in anchor mode (no appId) ─────────────────────────
  // Anchor mode: proof is stored in the note field of a 0-ALGO self-payment.
  // Use this while testing before contract deployment.
  const client = new AlgoPayClient({
    mnemonic,
    network: "testnet",
    // appId: Number(process.env.ALGO_APP_ID),  // uncomment after deployment
  });

  // ── 3. Sign a payment proof ────────────────────────────────────────────
  const proof = client.signer.sign({
    payment_id: "demo_" + Date.now(),
    amount:     100,
    action:     "unlock",
    currency:   "INR",
  });

  console.log("✍️  Signed proof:");
  console.log(JSON.stringify(proof, null, 2));

  // ── 4. Verify offline (no network) ────────────────────────────────────
  const offchainResult = client.verifyProofOffchain(proof);
  console.log("\n🔍 Off-chain verify:", offchainResult.valid ? "✅ valid" : "❌ " + offchainResult.reason);

  // ── 5. Submit to Algorand ─────────────────────────────────────────────
  console.log("\n⛓  Submitting to Algorand TestNet...");
  const result = await client.verifyAndCommit({
    payment_id: proof.payment_id,
    amount:     proof.amount,
    action:     proof.action,
    currency:   proof.currency,
  });

  console.log("\n✅ Success!");
  console.log("   txId        :", result.txId);
  console.log("   Explorer    :", result.explorerUrl);
  console.log("\n📋 APC-1 Credential:");
  console.log(JSON.stringify(result.apc1, null, 2));
}

main().catch(e => { console.error("Error:", e.message); process.exit(1); });
