# AlgoPay Oracle

Turn real-world payments into verifiable on-chain credentials.

AlgoPay Oracle is an infrastructure layer that converts fiat payment events (e.g., UPI / Razorpay) into cryptographically signed proofs, which are verified directly on-chain on Algorand. This allows smart contracts to act on real-world payments without relying on backend trust.

---

## Live Demo

🔗 **[Live Demo Link](https://algopay-oracle.vercel.app)**

---

## Demo Video

🎥 **[AlgoPay Oracle](https://youtu.be/Lk7Sh7oWcsg)**

---
## Architecture

<img width="8192" height="198" alt="Algopay Oracle" src="https://github.com/user-attachments/assets/db5029a9-76e8-42ba-a3a8-f303ce151b87" />


---

## Problem

Smart contracts cannot natively verify real-world payments.
Today, applications rely on backend confirmation:

Payment → Backend → Action

This introduces hidden trust, lack of verifiability, and no composability across applications.

---

## Solution

AlgoPay replaces backend trust with on-chain cryptographic verification:

Payment → Signed Proof → Smart Contract Verification → Action

The contract does not trust the backend. It only accepts valid signatures from the oracle.

---

## How It Works

1. A payment is triggered (UPI / Razorpay or simulated for demo reliability)
2. A webhook (or simulated trigger) activates the oracle
3. The oracle:

   * encodes payment data deterministically
   * signs the message using Ed25519
4. The smart contract:

   * verifies the signature using `ed25519verify_bare`
   * enforces timestamp validity
   * prevents replay using box storage
5. The action is executed
6. A verifiable proof is emitted on-chain

---

## Trust Model

The oracle key acts as the trust anchor, similar to price feed oracles in Web3.

* The contract enforces signature validity
* Data cannot be modified after signing
* Replay is prevented on-chain
* Proofs are publicly verifiable

This model is explicit and auditable, not hidden in backend logic.

---

## Why Not Just Use a Backend?

Implementing this securely requires:

* cryptographic signing
* deterministic encoding
* replay protection
* handling AVM opcode constraints

AlgoPay abstracts this into a reusable primitive:

verify_payment(...) → execute logic

---

## Key Technical Highlights

* On-chain Ed25519 signature verification (`ed25519verify_bare`)
* Deterministic byte-level encoding (no JSON parsing on-chain)
* Opcode budget pooling using atomic transaction grouping
* Replay protection via box storage
* Time-bound proof validation
* Fully composable across applications

---

## Use Cases

* SaaS subscription gating via UPI payments
* NFT receipts for real-world purchases
* DAO voting tied to payments
* Ticketing and event access systems
* Pay-to-access APIs or digital services

---

## Target Users

Developers building applications that need to bridge fiat payments with on-chain logic, especially in markets where UPI or similar systems dominate.

---

## Demo Flow

* User initiates payment
* Oracle signs payment proof
* Smart contract verifies proof on-chain
* Action executes (e.g., unlock content)
* Transaction and proof are displayed and verifiable

---

## Limitations

* Single oracle (centralized trust anchor)

---

## Roadmap

* Multi-oracle / threshold signature support
* Standardized proof format for interoperability
* Cross-application composability
* Potential ZK-based verification extensions

---

## Product Perspective

AlgoPay acts as a payment verification layer for Web3.

Instead of every team building custom integrations, it provides a reusable, standardized way to verify payments on-chain.

---

## Setup

### Backend

```
cd backend
npm install
```

Create `.env`:

```
ORACLE_MNEMONIC=your_mnemonic
ALGO_APP_ID=your_app_id
```

Run:

```
node index.js
```

---

### Frontend

```
cd frontend
npm install
npm run dev
```

Create `.env`:

```
VITE_API_URL=http://localhost:5000
```

---

## Deployment

Frontend: Vercel
Backend: Render

Set:

```
VITE_API_URL=https://your-backend-url
```

---

## Smart Contract Overview

* `verify_payment()`:

  * verifies signature
  * checks timestamp
  * prevents replay
  * emits proof

* `nop()`:

  * used for opcode budget pooling

---

## Conclusion

AlgoPay transforms payments into verifiable, reusable on-chain credentials.

It bridges Web2 payment systems with Web3 execution in a secure and composable way.
