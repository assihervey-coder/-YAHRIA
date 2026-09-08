#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# PTA-002 — PORTE COMPORTEMENTALE (implémentation EVO-000025, v2)
# « Sondes pytest avant SEALED » — jumeau Python de
# src/lib/yahria/behavioral-gate.ts (calibrage + vérification indépendante)
#
# 3 étapes : DÉCOUVERTE → PYTEST → COMPORTEMENT
# Usage :
#   python3 pta-behavioral-gate.py <répertoire|zip> [--json OUT] [--label L]
#                                  [--expect FAIL|PASS]
# Exit : 0 = PASS (ou FAIL attendu si --expect correspond) ; 1 = échec réel
# ═══════════════════════════════════════════════════════════════════
import argparse
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
import zipfile
from datetime import datetime, timezone

PYTEST_TIMEOUT = 180


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def discover_tests(root):
    out = []
    tdir = os.path.join(root, "tests")
    if os.path.isdir(tdir):
        for fn in sorted(os.listdir(tdir)):
            if fn.lower().endswith(".py") and (fn.startswith("test_") or fn.endswith("_test.py")):
                out.append(os.path.join("tests", fn))
    if not out:
        for fn in sorted(os.listdir(root)):
            if fn.lower().endswith(".py") and (fn.startswith("test_") or fn.endswith("_test.py")):
                out.append(fn)
    return out


def gate(root, label):
    stages = []
    t0 = time.monotonic()

    # 1. DÉCOUVERTE
    t1 = time.monotonic()
    test_files = discover_tests(root)
    stages.append({
        "stage": "DÉCOUVERTE", "state": "PASS" if test_files else "FAIL",
        "detail": f"{len(test_files)} fichier(s) de test : {', '.join(test_files)}" if test_files
                  else "aucun test découvert (tests/ ou test_*.py) — livrable non vérifiable comportementalement",
        "ms": int((time.monotonic() - t1) * 1000),
    })
    if not test_files:
        return stages, False

    # 2. PYTEST (plugin asyncio désactivé — venv plateforme incompatible, tests sync)
    t2 = time.monotonic()
    env = dict(os.environ)
    env.setdefault("PYTHONDONTWRITEBYTECODE", "1")
    env["PYTHONPATH"] = root + os.pathsep + env.get("PYTHONPATH", "")
    try:
        p = subprocess.run(
            [sys.executable, "-m", "pytest", *test_files, "-q", "-p", "no:asyncio", "--no-header"],
            cwd=root, capture_output=True, text=True, timeout=PYTEST_TIMEOUT, env=env,
        )
        code, stdout, stderr, timed_out = p.returncode, p.stdout, p.stderr, False
    except subprocess.TimeoutExpired:
        code, stdout, stderr, timed_out = 124, "", "", True

    lines = [l for l in stdout.splitlines() if l.strip()]
    summary = lines[-1].strip() if lines else ""
    m = re.search(r"(\d+) passed", summary)
    f = re.search(r"(\d+) failed", summary)
    e = re.search(r"(\d+) error", summary)
    n_passed = int(m.group(1)) if m else 0
    n_failed = (int(f.group(1)) if f else 0) + (int(e.group(1)) if e else 0)
    tail = " | ".join((stderr or stdout).strip().splitlines()[-3:])[:400]
    stages.append({
        "stage": "PYTEST", "state": "PASS" if code == 0 and not timed_out else "FAIL",
        "detail": (f"pytest sans terminer en {PYTEST_TIMEOUT}s — suite suspendue" if timed_out else
                   f"pytest exit {code} — {summary or 'aucun résumé décodable'}" + (f" — {tail}" if code != 0 else "")),
        "ms": int((time.monotonic() - t2) * 1000),
    })
    if code != 0 or timed_out:
        return stages, False

    # 3. COMPORTEMENT
    stages.append({
        "stage": "COMPORTEMENT", "state": "PASS" if n_passed > 0 else "FAIL",
        "detail": f"{n_passed} sonde(s) comportementale(s) verte(s), {n_failed} rouge(s)" if n_passed else "0 test exécuté — suite vide",
        "ms": 0,
    })
    passed = n_passed > 0
    return stages, passed


def main():
    ap = argparse.ArgumentParser(description="PTA-002 — porte comportementale (EVO-000025)")
    ap.add_argument("target", help="répertoire projet ou fichier .zip")
    ap.add_argument("--json", dest="json_out", help="écrire le rapport JSON complet ici")
    ap.add_argument("--label", default="", help="étiquette du sujet")
    ap.add_argument("--expect", choices=["PASS", "FAIL"], help="verdict attendu (mode calibrage)")
    args = ap.parse_args()

    tmp = None
    root = args.target
    if args.target.lower().endswith(".zip"):
        tmp = tempfile.mkdtemp(prefix="pta-bgate-")
        with zipfile.ZipFile(args.target) as z:
            z.extractall(tmp)
        entries = [e for e in os.listdir(tmp) if not e.startswith("__MACOSX")]
        if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
            root = os.path.join(tmp, entries[0])
        else:
            root = tmp

    t0 = time.monotonic()
    try:
        stages, passed = gate(root, args.label)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    total_ms = int((time.monotonic() - t0) * 1000)

    report = {
        "gate": "PTA-002/EVO-000025-behavioral-gate",
        "version": "1.0",
        "ts": now_iso(),
        "label": args.label or args.target,
        "target": args.target,
        "passed": passed,
        "verdict": "PASS" if passed else "FAIL",
        "totalMs": total_ms,
        "stages": stages,
    }
    line = " │ ".join(f"{s['stage']}:{s['state']}" for s in stages)
    print(f"[PTA-BGATE] {report['label']} → {report['verdict']} ({total_ms} ms) │ {line}")
    for s in stages:
        if s["state"] == "FAIL":
            print(f"            └─ {s['stage']} : {s['detail'][:400]}")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as fp:
            json.dump(report, fp, ensure_ascii=False, indent=2)

    if args.expect:
        ok = (args.expect == "PASS") == passed
        print(f"[PTA-BGATE] calibrage : attendu {args.expect}, obtenu {report['verdict']} → {'CONFORME' if ok else 'DIVERGENCE'}")
        sys.exit(0 if ok else 1)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
