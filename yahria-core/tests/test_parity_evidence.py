# ═══════════════════════════════════════════════════════════════
# R7.1 — Parity grid: evidence engine (KRN-005)
# SHA-256 chain must be byte-identical across runtimes.
# Clock is injected (FIXED_T0..T2 in the TS generator).
# ═══════════════════════════════════════════════════════════════

import pytest

from kernel.evidence_engine import (
    EVIDENCE_LIFECYCLE,
    EvidenceCapture,
    EvidenceRecord,
    capture_evidence,
    check_minimum_contract,
    hash_payload,
    reset_chain,
    set_seq_start,
    verify_evidence,
)

pytestmark = pytest.mark.parity

FIXED_T0 = "2026-01-15T10:00:00.000Z"
FIXED_T1 = "2026-01-15T10:00:01.000Z"
FIXED_T2 = "2026-01-15T10:00:02.000Z"


@pytest.fixture(autouse=True)
def _fresh_chain():
    reset_chain()
    yield
    reset_chain()


def test_hash_battery_zero_divergence(parity):
    """hashPayload: JS JSON.stringify serialization must be reproduced."""
    for case in parity["evidence"]["hashBattery"]:
        assert hash_payload(case["payload"]) == case["hash"], (
            f"HASH DIVERGENCE on payload #{case['i']}: {case['payload']!r}"
        )


def test_capture_chain_full_parity(parity):
    """Capture A → B → C with injected clock; compare full records."""
    cap_a = capture_evidence(
        EvidenceCapture(
            category="CODE", criticality="STANDARD", actorType="AGENT", actorId="coder-1",
            claim="file written", payload={"path": "src/app.ts", "bytes": 120},
        ),
        now=FIXED_T0,
    )
    cap_b = capture_evidence(
        EvidenceCapture(
            category="TEST", criticality="CRITICAL", actorType="SYSTEM", actorId="fabric",
            claim="tests passed", payload={"passed": 12, "failed": 0}, executionId="EX-1",
        ),
        now=FIXED_T1,
    )
    set_seq_start(41)
    cap_c = capture_evidence(
        EvidenceCapture(
            category="TEST", criticality="HIGH", actorType="SYSTEM", actorId="fabric",
            claim="chain continues", executionId="EX-1",
        ),
        now=FIXED_T2,
    )

    ts = parity["evidence"]["captures"]
    assert cap_a.to_dict() == ts["capA"]
    assert cap_b.to_dict() == ts["capB"]
    assert cap_c.to_dict() == ts["capC"]

    link = parity["evidence"]["chainLinkage"]
    assert cap_a.prevHash is None
    assert link["bPrevEqualsAHash"] is True and link["cPrevEqualsBHash"] is True
    assert cap_b.prevHash == cap_a.contentHash == link["aHash"]
    assert cap_c.prevHash == cap_b.contentHash == link["bHash"]


def test_uid_sequence_with_set_seq_start(parity):
    """UID format EV-<CATEGORY>-<seq:06d>, counter raised by setSeqStart."""
    uids = parity["evidence"]["uids"]
    cap_a = capture_evidence(
        EvidenceCapture(category="CODE", criticality="STANDARD", actorType="AGENT", actorId="coder-1", claim="file written", payload={"path": "src/app.ts", "bytes": 120}),
        now=FIXED_T0,
    )
    cap_b = capture_evidence(
        EvidenceCapture(category="TEST", criticality="CRITICAL", actorType="SYSTEM", actorId="fabric", claim="tests passed", payload={"passed": 12, "failed": 0}, executionId="EX-1"),
        now=FIXED_T1,
    )
    set_seq_start(41)
    cap_c = capture_evidence(
        EvidenceCapture(category="TEST", criticality="HIGH", actorType="SYSTEM", actorId="fabric", claim="chain continues", executionId="EX-1"),
        now=FIXED_T2,
    )
    assert [cap_a.evidenceUid, cap_b.evidenceUid, cap_c.evidenceUid] == [uids["a"], uids["b"], uids["c"]]
    assert cap_c.evidenceUid == "EV-TEST-000042"


def test_verify_battery_zero_divergence(parity):
    """verify_evidence: integrity recompute, tamper detection, terminal states."""
    ts_by_label = {c["label"]: c["result"] for c in parity["evidence"]["verifyBattery"]}

    cap_a_ts = parity["evidence"]["captures"]["capA"]
    cap_b_ts = parity["evidence"]["captures"]["capB"]

    def record_from(ts_record, **overrides):
        return EvidenceRecord(**{**ts_record, **overrides})

    sealed = record_from(cap_b_ts, state="SEALED")
    tampered = record_from(cap_b_ts, state="SEALED", claim="tests passed (tampered)")
    still_hashed = record_from(cap_a_ts)
    expired = record_from(cap_b_ts, state="EXPIRED")
    corrupted = record_from(cap_b_ts, state="CORRUPTED")

    for rec, label in (
        (sealed, "sealed-ok"),
        (tampered, "sealed-tampered"),
        (still_hashed, "hashed-not-verifiable"),
        (expired, "expired"),
        (corrupted, "corrupted-state"),
    ):
        py = verify_evidence(rec)
        ts = ts_by_label[label]
        assert py["ok"] == ts["ok"], f"ok divergence on {label}: {py['ok']} != {ts['ok']}"
        assert py["reason"] == ts["reason"], f"reason divergence on {label}: {py['reason']!r} != {ts['reason']!r}"


def test_verify_ok_is_boolean(parity):
    cap_b_ts = parity["evidence"]["captures"]["capB"]
    sealed = EvidenceRecord(**{**cap_b_ts, "state": "SEALED"})
    res = verify_evidence(sealed)
    assert res["ok"] is True
    assert isinstance(res["ok"], bool)


def test_minimum_contract_battery(parity):
    """Replay identical inputs, compare {ok, missing[]} exactly."""
    replay = [
        ("minimal-ok", EvidenceCapture(category="CODE", criticality="STANDARD", actorType="AGENT", actorId="a", claim="c")),
        ("missing-claim", EvidenceCapture(category="CODE", criticality="STANDARD", actorType="AGENT", actorId="a", claim="")),
        ("critical-no-context", EvidenceCapture(category="TEST", criticality="CRITICAL", actorType="SYSTEM", actorId="s", claim="x")),
        ("critical-with-trace", EvidenceCapture(category="TEST", criticality="CRITICAL", actorType="SYSTEM", actorId="s", claim="x", traceId="TR-1")),
        ("missing-two", EvidenceCapture(category="CODE", criticality="LOW", actorType="", actorId="a", claim=None)),
    ]
    ts_by_label = {c["label"]: c["result"] for c in parity["evidence"]["contractBattery"]}
    assert len(replay) == len(ts_by_label) == 5
    for label, ec in replay:
        py = check_minimum_contract(ec)
        ts = ts_by_label[label]
        assert py == ts, f"minimum contract divergence on {label}: {py} != {ts}"


def test_lifecycle_constant_parity(parity):
    assert EVIDENCE_LIFECYCLE == parity["evidence"]["lifecycle"]
