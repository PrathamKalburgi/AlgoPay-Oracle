from algopy import (
    ARC4Contract,
    Bytes,
    GlobalState,
    UInt64,
    arc4,
    op,
)
from algopy.arc4 import abimethod

# ─── Constants ────────────────────────────────────────────────────────────────
PROOF_PREFIX        = b"AlgoPay:v1:"
PROOF_VALIDITY_SECS = 300   # proof expires 5 min after oracle signed it

# Oracle registry box cost: 2500 + 400*(32+1) = 15700 microALGO per oracle
# Fund contract with at least 0.1 ALGO after deploy


class PaymentVerified(arc4.Struct):
    """ARC-28 event emitted on every successful payment verification."""
    payment_id: arc4.String
    action:     arc4.String
    amount:     arc4.UInt64
    currency:   arc4.String
    timestamp:  arc4.UInt64


class AlgoPayOracle(ARC4Contract):
    """
    AlgoPay Oracle — trustless on-chain payment verification with oracle rotation.

    Oracle registry:
        Box key   = oracle Ed25519 pubkey (32 bytes)
        Box value = b"1" (existence flag)
        Any registered oracle can sign valid proofs.
        Creator can add / remove oracles at any time.

    Trust model:
        - No hardcoded pubkeys — oracles registered at deploy time and rotatable
        - Contract verifies Ed25519 sig against registered oracle registry
        - Replay protection via separate payment_id boxes
        - Time-bound proofs (5 min validity window)
        - Minimum amount enforced on-chain
    """

    def __init__(self) -> None:
        self.total_verified = GlobalState(UInt64)
        self.oracle_count   = GlobalState(UInt64)
        self.min_amount     = GlobalState(UInt64)

    # ── Create ────────────────────────────────────────────────────────────────
    @abimethod(create="require")
    def create(self, initial_oracle_pubkey: arc4.DynamicBytes) -> None:
        """
        Deploy contract state.

        initial_oracle_pubkey is kept for backend/API compatibility, but the
        first oracle is registered after deploy to avoid box MBR issues during
        app creation.
        """
        assert initial_oracle_pubkey.native.length == UInt64(32), "pubkey must be 32 bytes"

        self.total_verified.value = UInt64(0)
        self.oracle_count.value   = UInt64(0)
        self.min_amount.value = UInt64(100)

    @abimethod
    def set_min_amount(self, new_amount: arc4.UInt64) -> None:
        assert op.Txn.sender == op.Global.creator_address, "only creator"
        self.min_amount.value = new_amount.native # <--- ALLOW ADMIN UPDATES



    @abimethod
    def bootstrap_oracle(self, initial_oracle_pubkey: arc4.DynamicBytes) -> None:
        """
        Register the first oracle after deployment.
        This keeps deployment stable while preserving the same oracle registry
        model and backend-facing verification flow.
        """
        assert op.Txn.sender == op.Global.creator_address, "only creator"
        assert self.oracle_count.value == UInt64(0), "already initialized"
        assert initial_oracle_pubkey.native.length == UInt64(32), "pubkey must be 32 bytes"

        op.Box.put(initial_oracle_pubkey.native, Bytes(b"1"))
        self.oracle_count.value = UInt64(1)

    # ── Oracle management (creator only) ──────────────────────────────────────
    @abimethod
    def add_oracle(self, pubkey: arc4.DynamicBytes) -> None:
        """
        Register a new oracle. Only the contract creator can call this.
        pubkey: 32-byte Ed25519 pubkey of the oracle to add.
        Requires contract to be funded for box MBR (~15700 microALGO per oracle).
        """
        assert op.Txn.sender == op.Global.creator_address, "only creator"
        assert pubkey.native.length == UInt64(32), "pubkey must be 32 bytes"

        box_val, already_exists = op.Box.get(pubkey.native)
        assert not already_exists, "oracle already registered"

        op.Box.put(pubkey.native, Bytes(b"1"))
        self.oracle_count.value += UInt64(1)

    @abimethod
    def remove_oracle(self, pubkey: arc4.DynamicBytes) -> None:
        """
        Deregister an oracle. Only creator. Reclaims box MBR.
        After removal, proofs signed by this oracle will be rejected.
        """
        assert op.Txn.sender == op.Global.creator_address, "only creator"
        assert self.oracle_count.value > UInt64(1), "cannot remove last oracle"

        existed = op.Box.delete(pubkey.native)
        assert existed, "oracle not registered"

        self.oracle_count.value -= UInt64(1)

    @abimethod(readonly=True)
    def is_oracle(self, pubkey: arc4.DynamicBytes) -> arc4.Bool:
        """Read-only: check if a pubkey is a registered oracle."""
        box_val, exists = op.Box.get(pubkey.native)
        return arc4.Bool(exists)

    # ── verify_payment ─────────────────────────────────────────────────────────
    @abimethod
    def verify_payment(
        self,
        payment_id:    arc4.String,
        action:        arc4.String,
        amount:        arc4.UInt64,
        currency:      arc4.String,
        timestamp:     arc4.UInt64,
        app_id:        arc4.UInt64,
        oracle_pubkey: arc4.DynamicBytes,  # which oracle signed this proof
        signature:     arc4.DynamicBytes,
    ) -> arc4.Bool:
        """
        Verify an oracle-signed payment proof.

        Checks (in order):
          1. Amount >= MIN_AMOUNT
          2. Proof not expired (timestamp within 5 min)
          3. oracle_pubkey is a registered oracle
          4. Ed25519 signature is valid
          5. payment_id not already processed (replay protection)

        On success: stores payment_id, increments counter, emits ARC-28 event.

        Box references required in the ATC call:
          - oracle_pubkey bytes  (oracle registry lookup)
          - payment_id bytes     (replay protection write)
        """

        # 1. Minimum amount
        assert amount.native >= self.min_amount.value, "insufficient payment amount"

        # 2. Timestamp validity — if/else prevents UInt64 underflow on future timestamps.
        # Subtraction is safe in each branch because the direction is known.
        if timestamp.native > op.Global.latest_timestamp:
            # Proof from the future: allow up to 30 s of clock skew
            assert timestamp.native - op.Global.latest_timestamp <= UInt64(30), "timestamp too far in future"
        else:
            # Proof from the past: enforce the 5-minute freshness window
            assert op.Global.latest_timestamp - timestamp.native < UInt64(PROOF_VALIDITY_SECS), "proof expired"

        # 3. Oracle registry check
        oracle_box_val, oracle_registered = op.Box.get(oracle_pubkey.native)
        assert oracle_registered, "oracle not registered"

        assert app_id.native == op.Global.current_application_id.id, "proof not valid for this app"

        # 4. Reconstruct signed message and verify Ed25519 signature
        #    Byte order must match oracle.js OracleSigner.buildMessage() exactly:
        #    MX + AlgoPay:v1: + payment_id + action + currency + amount(8B BE) + timestamp(8B BE)
        message = (
            Bytes(b"MX") +
            Bytes(PROOF_PREFIX) +
            payment_id.native.bytes +
            action.native.bytes +
            currency.native.bytes +
            amount.bytes +
            timestamp.bytes +
            app_id.bytes
        )

        sig_valid = op.ed25519verify_bare(
            message,
            signature.native,
            oracle_pubkey.native,
        )
        assert sig_valid, "invalid oracle signature"

        # 5. Replay protection — box key is canonical_id, not raw payment_id
        #    canonical_id = "provider:payment_id" prevents cross-provider replay
        box_key = payment_id.native.bytes
        pay_box_val, already_processed = op.Box.get(box_key)
        assert not already_processed, "payment already processed"

        op.Box.put(box_key, Bytes(b"1"))
        self.total_verified.value += UInt64(1)

        # ARC-28 event
        arc4.emit(
            PaymentVerified(
                payment_id=payment_id,
                action=action,
                amount=amount,
                currency=currency,
                timestamp=timestamp,
            )
        )

        return arc4.Bool(True)

    # ── nop ───────────────────────────────────────────────────────────────────
    @abimethod
    def nop(self) -> None:
        """
        Budget padding. Called in atomic group before verify_payment
        to pool opcode budget for ed25519verify_bare (cost: 1900).
        3x nop + 1x verify = 4 * 700 base + 1900 ed25519 = sufficient budget.
        """
        pass

    # ── Read-only helpers ──────────────────────────────────────────────────────
    @abimethod(readonly=True)
    def check_payment(self, payment_id: arc4.String) -> arc4.Bool:
        """Has this payment_id (canonical namespaced ID) already been verified?"""
        box_val, exists = op.Box.get(payment_id.native.bytes)
        return arc4.Bool(exists)

    @abimethod(readonly=True)
    def get_stats(self) -> arc4.UInt64:
        """Total verified payments across all oracles."""
        return arc4.UInt64(self.total_verified.value)

    @abimethod(readonly=True)
    def get_oracle_count(self) -> arc4.UInt64:
        """Number of registered oracles."""
        return arc4.UInt64(self.oracle_count.value)

    # ── Admin ──────────────────────────────────────────────────────────────────
    @abimethod(allow_actions=["UpdateApplication", "DeleteApplication"])
    def admin(self) -> None:
        """Creator-only: update or delete the contract."""
        assert (
            op.Txn.sender == op.Global.creator_address
        ), "only creator can update/delete"
