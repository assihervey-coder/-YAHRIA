#!/usr/bin/env python3
"""Test E2E R11 — preuve live sandbox sur une mission FastAPI réelle."""
import json
import sys
import time
import urllib.request

BASE = "http://localhost:3000/api/yahria"


def api(path: str, payload: dict | None = None, method: str = "GET") -> dict:
    data = json.dumps(payload).encode() if payload is not None else None
    req = urllib.request.Request(
        f"{BASE}{path}", data=data, method=method,
        headers={"Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=1200) as r:
        return json.loads(r.read())


TREE = ("requirements.txt\napp/\n├── __init__.py\n├── main.py\n├── schemas.py\n"
        "└── routers/\n    └── weather.py\ntests/test_weather.py\nREADME.md")

print("══ 1. Soumission de la mission FastAPI ══")
run = None
for essai in range(3):
    try:
        d = api("/studio/runs", {
            "name": "API météo FastAPI (test live R11)",
            "brief": ("API REST FastAPI de prévisions météo : endpoint /health, endpoint /forecast "
                      "retournant 7 jours de prévisions en JSON, validation Pydantic, "
                      "documentation OpenAPI automatique. Prête à lancer avec uvicorn."),
            "requestedStack": "PYTHON",
            "treeSpec": TREE,
            "aiDesignedTree": False,
        }, method="POST")
        if d.get("ok"):
            run = d["run"]
            break
        print(f"  refus ({essai + 1}) : {d.get('error')}")
    except Exception as e:
        print(f"  erreur ({essai + 1}) : {e}")
    time.sleep(4)
if not run:
    sys.exit("ÉCHEC: soumission impossible")
print(f"  RUN: {run['runUid']} ({run['id']})")

print("══ 2. Attente de SEALED ══")
state = None
for i in range(60):
    time.sleep(5)
    d = api(f"/studio/runs/{run['id']}")
    state = d["run"]["state"]
    print(f"  [{(i + 1) * 5}s] état: {state}")
    if state in ("SEALED", "FAILED"):
        break
if state != "SEALED":
    sys.exit(f"ÉCHEC: run non scellé ({state}) — error: {d['run'].get('error')}")

print("══ 3. PREUVE LIVE (execute) ══")
res = api(f"/studio/runs/{run['id']}/execute", {}, method="POST")
print(json.dumps({k: res.get(k) for k in ("ok", "verdict", "attempts", "repaired", "reason", "port", "state")}, ensure_ascii=False, indent=2))

print("══ 4. Rapports LiveCheck ══")
d = api(f"/studio/runs/{run['id']}/execute")
for c in d.get("liveChecks", []):
    rep = json.loads(c["report"])
    print(f"  tentative {c['attempt']} → {c['state']} ({rep.get('ms')} ms) : {rep.get('reason')}")
    for s in rep.get("steps", []):
        print(f"    {'✓' if s['ok'] else '✗'} {s['label']}: {s['cmd']} ({s['ms']} ms)")
    for p in rep.get("probes", []):
        ok = p["status"] is not None and p["status"] < 400
        print(f"    {'✓' if ok else '✗'} GET {p['path']} → {p['status']} « {p['bodyStart'][:50]} »")
print(f"\nRUN ID final: {run['id']}")
