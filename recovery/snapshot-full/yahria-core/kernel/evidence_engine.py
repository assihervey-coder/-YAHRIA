# ═══════════════════════════════════════════════════════════════
# YAHRIA KERNEL (Python port) — Evidence Engine (Domain 11)
# Doc ID: YAHRIA-KRN-005-PY | Source: EVIDENCE_MANIFEST.md
# Port of: src/lib/yahria/evidence-engine.ts (YAHRIA-KRN-005)
# CLAIM + PROVENANCE + INTEGRITY + CONTEXT + TIME + LINEAGE = VERIFIABLE EVIDENCE
# ═══════════════════════════════════════════════════════════════

import hashlib
from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from kernel.canonical_json import js_stringify

EVIDENCE_CATEGORIES = [
    "CODE", "BUILD", "TEST", "EXECUTION", "TOOL", "AGENT", "MODEL",
    "POLICY", "SECURITY", "CONFIGURATION", "DATABASE", "ARTIFACT",
    "TRACE", "METRIC", "AUDIT", "RELEASE", "DEPLOYMENT", "INCIDENT",
    "FORENSIC", "REPLAY",
]

CRITICALITIES = ["CRITICAL", "HIGH", "STANDARD", "LOW", "INFORMATIONAL"]

ACTOR_TYPES = ["HUMAN", "AGENT", "SYSTEM", "TOOL", "MODEL"]


@dataclass
class EvidenceCapture:
    category: str
    criticality: str
    actorType: str
    actorId: str
    claim: str
    payload: Optional[Dict[str, Any]] = None
    executionId: Optional[str] = None
    taskId: Optional[str] = None
    traceId: Optional[str] = None
    tenantContext: Optional[str] = None
    organizationContext: Optional[str] = None
    policyVersion: Optional[str] = None


@dataclass
class EvidenceRecord:
    evidenceUid: str
    category: str
    criticality: str
    state: str
    actorType: str
    actorId: str
    claim: str
    payload: Optional[str]
    contentHash: str
    prevHash: Optional[str]
    createdAt: str

    def to_dict(self) -> dict:
        return {
            "evidenceUid": self.evidenceUid,
            "category": self.category,
            "criticality": self.criticality,
            "state": self.state,
            "actorType": self.actorType,
            "actorId": self.actorId,
            "claim": self.claim,
            "payload": self.payload,
            "contentHash": self.contentHash,
            "prevHash": self.prevHash,
            "createdAt": self.createdAt,
        }


# ── In-memory chain state (module-level, mirrors the TS module) ─────
_seq = 0
_hash_chain: List[str] = []


def reset_chain() -> None:
    """Test helper — the TS module state resets naturally per process."""
    global _seq
    _hash_chain.clear()
    _seq = 0


def set_seq_start(n: int) -> None:
    """Align the UID counter with durable storage (survives process restarts)."""
    global _seq
    if n > _seq:
        _seq = n


def next_uid(category: str) -> str:
    global _seq
    _seq += 1
    return f"EV-{category}-{str(_seq).zfill(6)}"


def hash_payload(payload: Any) -> str:
    # TS: createHash('sha256').update(JSON.stringify(payload)).digest('hex')
    return hashlib.sha256(js_stringify(payload).encode("utf-8")).hexdigest()


# Canonical lifecycle: DECLARED → CAPTURED → NORMALIZED → HASHED → LINKED → VERIFIED → SEALED
EVIDENCE_LIFECYCLE = [
    "DECLARED", "CAPTURED", "NORMALIZED", "HASHED", "LINKED", "VERIFIED", "SEALED",
]


def _default_now_iso() -> str:
    # JS new Date().toISOString() -> 'YYYY-MM-DDTHH:MM:SS.sssZ' (milliseconds, Z)
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.") + f"{datetime.now(timezone.utc).microsecond // 1000:03d}Z"


def capture_evidence(data: EvidenceCapture, now: Optional[str] = None) -> EvidenceRecord:
    """Capture a piece of evidence into the hash chain.

    `now` (ISO string) injects a deterministic clock — used by parity
    tests (R7.1). Default behavior (real clock) is unchanged.
    """
    captured_at = now if now is not None else _default_now_iso()
    payload_json: Optional[str] = None
    if data.payload is not None:
        payload_json = js_stringify({**data.payload, "capturedAt": captured_at})
    prev_hash = _hash_chain[-1] if _hash_chain else None
    content_hash = hash_payload({
        "category": data.category,
        "claim": data.claim,
        "actor": f"{data.actorType}:{data.actorId}",
        "payload": payload_json,
        "prevHash": prev_hash,
    })
    _hash_chain.append(content_hash)
    return EvidenceRecord(
        evidenceUid=next_uid(data.category),
        category=data.category,
        criticality=data.criticality,
        state="HASHED",
        actorType=data.actorType,
        actorId=data.actorId,
        claim=data.claim,
        payload=payload_json,
        contentHash=content_hash,
        prevHash=prev_hash,
        createdAt=captured_at,
    )


def verify_evidence(record: EvidenceRecord) -> Dict[str, str]:
    if record.state in ("SEALED", "VERIFIED"):
        # recompute integrity
        recomputed = hash_payload({
            "category": record.category,
            "claim": record.claim,
            "actor": f"{record.actorType}:{record.actorId}",
            "payload": record.payload,
            "prevHash": record.prevHash,
        })
        if recomputed != record.contentHash:
            return {"ok": False, "reason": "INTEGRITY FAILURE: recomputed hash differs — evidence CORRUPTED (INV-110)"}
        return {"ok": True, "reason": "Integrity verified: content hash matches (INV-110)"}
    if record.state in ("EXPIRED", "DISPOSED", "INVALID", "CORRUPTED"):
        return {"ok": False, "reason": f"Evidence in terminal failure state {record.state} — cannot verify"}
    return {"ok": False, "reason": f"Evidence not yet in verifiable state (current: {record.state})"}


# EVIDENCE MINIMUM CONTRACT check (EVIDENCE_MANIFEST §9)
def check_minimum_contract(data: EvidenceCapture) -> Dict[str, Any]:
    required = ["category", "criticality", "actorType", "actorId", "claim"]
    values = {
        "category": data.category,
        "criticality": data.criticality,
        "actorType": data.actorType,
        "actorId": data.actorId,
        "claim": data.claim,
    }
    missing = [k for k in required if values[k] is None or values[k] == ""]
    context_required = data.criticality in ("CRITICAL", "HIGH")
    if context_required and not data.executionId and not data.taskId and not data.traceId:
        missing.append("executionId|taskId|traceId (critical evidence requires execution context)")
    return {"ok": len(missing) == 0, "missing": missing}
