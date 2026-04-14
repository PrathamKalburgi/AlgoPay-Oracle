from algopy import (
    ARC4Contract,
    Bytes,
    GlobalState,
    UInt64,
    arc4,
    op,
)
from algopy.arc4 import abimethod

ORACLE_PUBKEY_BYTES = b"\xf3\xaf\x36\xbe\x0b\x65\xec\xa7\x3f\xbe\x33\xe1\x33\xb5\x0b\x7f\x69\x31\xb4\x6f\x30\xe8\x00\x54\x25\x26\x6d\xa5\xa9\x1c\x99\x12"

PROOF_PREFIX        = b"AlgoPay:v1:"
PROOF_VALIDITY_SECS = 300   # proof expires 5 min after oracle signed it
MIN_AMOUNT          = 100   # minimum fiat units (e.g. ₹100)


class PaymentVerified(arc4.Struct):
    payment_id:     arc4.String
    action:         arc4.String
    amount:         arc4.UInt64
    currency:       arc4.String
    oracle_address: arc4.String
    timestamp:      arc4.UInt64


class AlgoPayOracle(ARC4Contract):
    """
    AlgoPay Oracle — on-chain payment verification.
    Generalized Web3 gateway for any fiat payment system.
    """

    def __init__(self) -> None:
        self.oracle_pubkey  = GlobalState(Bytes)
        self.oracle_address = GlobalState(arc4.String)
        self.total_verified = GlobalState(UInt64)

    @abimethod(create="require")
    def create(self, oracle_addr: arc4.String) -> None:
        self.oracle_pubkey.value  = Bytes(ORACLE_PUBKEY_BYTES)
        self.oracle_address.value = oracle_addr
        self.total_verified.value = UInt64(0)

    @abimethod
    def verify_payment(
        self,
        payment_id: arc4.String,
        action:     arc4.String,
        amount:     arc4.UInt64,
        currency:   arc4.String,
        timestamp:  arc4.UInt64,   # unix seconds, signed by oracle
        signature:  arc4.DynamicBytes,
    ) -> arc4.Bool:

        # 1. Minimum amount check
        assert amount.native >= MIN_AMOUNT, "insufficient payment amount"

        # 2. Timestamp expiry — proof valid for 5 min only
        assert op.Global.latest_timestamp + 15 >= timestamp.native, "timestamp in future"
        assert op.Global.latest_timestamp - timestamp.native < PROOF_VALIDITY_SECS, "proof expired"

        # 3. Reconstruct signed message — must match oracle.js byte-for-byte
        message = (
            Bytes(b"MX") +
            Bytes(PROOF_PREFIX) +
            payment_id.native.bytes +
            action.native.bytes +
            currency.native.bytes +
            amount.bytes +
            timestamp.bytes
        )

        # 4. On-chain Ed25519 verification
        sig_valid = op.ed25519verify_bare(
            message,
            signature.native,
            self.oracle_pubkey.value,
        )
        assert sig_valid, "invalid oracle signature"

        # 5. Replay protection via box storage
        box_key = payment_id.native.bytes
        box_val, box_exists = op.Box.get(box_key)
        assert not box_exists, "payment already processed"

        op.Box.put(box_key, Bytes(b"1"))
        self.total_verified.value += UInt64(1)

        # 6. Emit richer ARC-28 event
        arc4.emit(
            PaymentVerified(
                payment_id=payment_id,
                action=action,
                amount=amount,
                currency=currency,
                oracle_address=self.oracle_address.value,
                timestamp=timestamp,
            )
        )

        return arc4.Bool(True)

    @abimethod
    def nop(self) -> None:
        """Budget padding — pools opcode budget for ed25519verify_bare."""
        pass

    @abimethod(readonly=True)
    def check_payment(self, payment_id: arc4.String) -> arc4.Bool:
        box_val, box_exists = op.Box.get(payment_id.native.bytes)
        return arc4.Bool(box_exists)

    @abimethod(readonly=True)
    def get_stats(self) -> arc4.UInt64:
        return arc4.UInt64(self.total_verified.value)

    @abimethod(allow_actions=["UpdateApplication", "DeleteApplication"])
    def admin(self) -> None:
        assert (
            op.Txn.sender == op.Global.creator_address
        ), "only creator can update/delete"
