#!/usr/bin/env python3
# ═══════════════════════════════════════════════════════════════════
# PTA-001 — PORTE DE BOOT EXÉCUTABLE (implémentation EVO-000016)
# « Prévalidation boot avant SEALED » — YAHRIA-STD-003 (jumeau Python)
#
# 6 étapes : INVENTAIRE → SYNTAXE → DÉCOUVERTE APP → BOOT → SONDES → VERDICT
# Sortie : verdict PASS/FAIL + rapport JSON sérialisable en preuve (INV-110)
#
# Usage :
#   python3 pta-boot-gate.py <répertoire|zip> [--json OUT] [--label L]
#                            [--env KEY=VAL]... [--expect FAIL|PASS] [--boot-wait S]
# Exit : 0 = PASS (ou FAIL attendu si --expect correspond) ; 1 = échec réel
# ═══════════════════════════════════════════════════════════════════
import argparse
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import urllib.error
import urllib.request
import zipfile
from datetime import datetime, timezone


def now_iso():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def free_port():
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.bind(("127.0.0.1", 0))
    port = s.getsockname()[1]
    s.close()
    return port


def list_files(root, exts=None):
    out = []
    for dirpath, dirnames, filenames in os.walk(root):
        dirnames[:] = [d for d in dirnames if d not in ("__pycache__", "node_modules", ".git", ".pytest_cache", "venv", ".venv")]
        for fn in filenames:
            if exts is not None and os.path.splitext(fn)[1].lower() not in exts:
                continue
            out.append(os.path.relpath(os.path.join(dirpath, fn), root))
    return sorted(out)


PY_SNIFF = re.compile(r"^\s*(from\s+\w+|import\s+\w+|def\s+\w+|class\s+\w+|async\s+def\s+\w+)\b", re.M)
MODULE_NAME_OK = re.compile(r"^[A-Za-z_][A-Za-z0-9_]*$")
STANDARD_EXT = re.compile(r"^\.[A-Za-z0-9]{1,8}$")


def structure_scan(root):
    """Détecte les îlots non importables — cause racine exacte de RUN-000021 :
    A. code Python hors module (fichier sans extension ou extension non standard) ;
    B. fichiers .py sous un chemin de package invalide (espaces/accents/emoji —
       importlib.import_module ne peut jamais les charger)."""
    invalid = []
    for rel in list_files(root):  # tous les fichiers
        parts = rel.split(os.sep)
        name = parts[-1]
        stem, ext = os.path.splitext(name)
        if ext.lower() == ".py":
            # règle B : chaque dossier parent doit être un identifiant Python valide
            for d in parts[:-1]:
                if not MODULE_NAME_OK.match(d):
                    invalid.append(f"{rel} (chemin de package invalide : « {d[:52]} » — non importable)")
                    break
            else:
                if not MODULE_NAME_OK.match(stem):
                    invalid.append(f"{rel} (nom de module invalide — non importable)")
        elif not STANDARD_EXT.match(ext) and not name.startswith("."):
            # règle A : extension absente ou non standard (ex : « . Achats… ») — îlot si du code Python s'y cache
            try:
                with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as f:
                    body = f.read(60_000)
            except OSError:
                continue
            if (body.startswith("#!/") and "python" in body[:48]) or PY_SNIFF.search(body):
                extlabel = ext[:24] if ext else "absente"
                invalid.append(f"{rel} (code Python hors module — îlot non importable, extension {extlabel})")
    return sorted(invalid)


def run_cmd(cmd, cwd, timeout_s):
    try:
        p = subprocess.run(cmd, cwd=cwd, capture_output=True, text=True, timeout=timeout_s)
        return p.returncode, p.stdout, p.stderr
    except subprocess.TimeoutExpired:
        return 124, "", f"timeout {timeout_s}s"
    except FileNotFoundError as e:
        return 127, "", str(e)


def rel_to_module(rel):
    """app/main.py → app.main ; main.py → main"""
    return rel[:-3].replace(os.sep, ".").replace("/", ".")


def find_app_module(root, py_files):
    """Trouve (module, instance) FastAPI : priorité main.py/app.py, packages inclus (app/main.py → app.main)."""
    pat = re.compile(r"^(\w+)\s*=\s*(?:FastAPI|create_app)\s*\(", re.M)
    candidates = []
    for rel in py_files:
        base = os.path.basename(rel)
        if base.startswith("test_") or base == "conftest.py":
            continue
        try:
            with open(os.path.join(root, rel), encoding="utf-8", errors="replace") as f:
                src = f.read(200_000)
        except OSError:
            continue
        m = pat.search(src)
        if m:
            candidates.append((rel_to_module(rel), m.group(1), rel))
    for pref in ("main", "app", "server"):
        for mod, inst, rel in candidates:
            if os.path.basename(rel)[:-3] == pref:
                return mod, inst
    return (candidates[0][:2] if candidates else None)


def load_dotenv_example(root):
    env = {}
    p = os.path.join(root, ".env.example")
    if os.path.isfile(p):
        try:
            with open(p, encoding="utf-8", errors="replace") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#") and "=" in line:
                        k, _, v = line.partition("=")
                        env[k.strip()] = v.strip().strip('"').strip("'")
        except OSError:
            pass
    return env


def http_probe(url, timeout=3):
    """Retourne (status|None, body_head). Toute réponse HTTP compte (même 404/500)."""
    req = urllib.request.Request(url, headers={"User-Agent": "PTA-boot-gate/1.0"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, r.read(200_000).decode("utf-8", "replace")
    except urllib.error.HTTPError as e:
        return e.code, ""
    except Exception:
        return None, ""


def boot_and_probe(root, module, instance, port, wait_s):
    """Démarre uvicorn, attend une réponse HTTP, sonde, retourne (étapes, process)."""
    stages = []
    env = dict(os.environ)
    env.update(load_dotenv_example(root))
    env["PYTHONPATH"] = root + os.pathsep + env.get("PYTHONPATH", "")
    env.setdefault("PYTHONDONTWRITEBYTECODE", "1")
    cmd = [sys.executable, "-m", "uvicorn", f"{module}:{instance}", "--host", "127.0.0.1", "--port", str(port), "--log-level", "warning"]
    t0 = time.monotonic()
    proc = subprocess.Popen(cmd, cwd=root, env=env, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
    up, last_err = False, ""
    deadline = t0 + wait_s
    while time.monotonic() < deadline:
        if proc.poll() is not None:
            last_err = (proc.stderr.read() or proc.stdout.read() or "processus sorti")[-1500:]
            break
        st, _ = http_probe(f"http://127.0.0.1:{port}/openapi.json", timeout=2)
        if st is not None:
            up = True
            break
        time.sleep(1.0)
    boot_ms = int((time.monotonic() - t0) * 1000)
    if not up:
        stages.append({"stage": "BOOT", "state": "FAIL", "detail": f"uvicorn {module}:{instance} sans réponse HTTP en {wait_s}s — {last_err.strip()[:600] or 'connexion refusée'}", "ms": boot_ms})
        return stages, proc, None
    stages.append({"stage": "BOOT", "state": "PASS", "detail": f"uvicorn {module}:{instance} répond sur :{port} (boot {boot_ms} ms)", "ms": boot_ms})

    # SONDES
    t1 = time.monotonic()
    probes = {}
    for path in ("/openapi.json", "/docs", "/health", "/"):
        st, body = http_probe(f"http://127.0.0.1:{port}{path}", timeout=3)
        probes[path] = st
    serving = [p for p, s in probes.items() if s is not None]
    stages.append({"stage": "SONDES", "state": "PASS" if serving else "FAIL",
                   "detail": f"{len(serving)}/4 routes répondent : {json.dumps(probes)}", "ms": int((time.monotonic() - t1) * 1000)})

    # OPENAPI — inventaire des endpoints réellement exposés
    st, body = http_probe(f"http://127.0.0.1:{port}/openapi.json", timeout=3)
    n_paths, n_ops = 0, 0
    if st == 200 and body:
        try:
            spec = json.loads(body)
            n_paths = len(spec.get("paths", {}))
            n_ops = sum(len(v) for v in spec.get("paths", {}).values())
        except json.JSONDecodeError:
            pass
    stages.append({"stage": "OPENAPI", "state": "PASS" if n_paths > 0 else "SKIP",
                   "detail": f"{n_paths} chemins / {n_ops} opérations exposées" if n_paths else "openapi.json absent ou vide (app non-FastAPI ?)", "ms": 0})
    return stages, proc, {"paths": n_paths, "operations": n_ops, "probes": probes}


def terminate(proc):
    if proc is None or proc.poll() is not None:
        return
    proc.terminate()
    try:
        proc.wait(timeout=3)
    except subprocess.TimeoutExpired:
        proc.kill()
        proc.wait(timeout=3)


def gate(root, label, boot_wait, extra_env):
    stages = []
    t0 = time.monotonic()
    proc = None
    openapi = None
    try:
        # 1. INVENTAIRE
        py_files = list_files(root, {".py"})
        js_files = list_files(root, {".js", ".mjs"})
        static_files = list_files(root, {".html", ".css"})
        if py_files:
            kind = "PYTHON"
        elif js_files:
            kind = "NODE"
        elif static_files:
            kind = "STATIC_WEB"
        else:
            kind = "EMPTY"
        stages.append({"stage": "INVENTAIRE", "state": "PASS" if kind != "EMPTY" else "FAIL",
                       "detail": f"stack détectée {kind} — {len(py_files)} .py, {len(js_files)} .js, {len(static_files)} statiques", "ms": 0})
        if kind == "EMPTY":
            return stages, False, None

        if kind == "PYTHON":
            # 2. STRUCTURE (importabilité — échec le plus précoce, cause racine RUN-000021)
            t1 = time.monotonic()
            invalid = structure_scan(root)
            head = "; ".join(invalid[:6]) + (f" … (+{len(invalid)-6})" if len(invalid) > 6 else "")
            stages.append({"stage": "STRUCTURE", "state": "FAIL" if invalid else "PASS",
                           "detail": f"{len(invalid)} îlot(s) non importable(s) : {head}" if invalid else "tous les fichiers Python sont importables (extensions + noms de module valides)", "ms": int((time.monotonic() - t1) * 1000)})
            if invalid:
                return stages, False, None

        if kind == "PYTHON":
            # 2. SYNTAXE (py_compile — échec rapide, liste les fichiers coupés)
            t1 = time.monotonic()
            rc, out, err = run_cmd([sys.executable, "-m", "py_compile"] + py_files, root, 60)
            bad = sorted({ln.split(":")[0] for ln in (err or "").splitlines() if "SyntaxError" in ln or "was never closed" in ln or "unterminated" in ln} ) if rc != 0 else []
            stages.append({"stage": "SYNTAXE", "state": "PASS" if rc == 0 else "FAIL",
                           "detail": f"{len(py_files)} fichiers compilés sans erreur" if rc == 0 else f"{len(bad)+1 if bad else '?'} fichier(s) en erreur de syntaxe : {', '.join((bad or ['?'])[:8])} — {(err or '').strip().splitlines()[-1][:220] if err else ''}", "ms": int((time.monotonic() - t1) * 1000)})
            if rc != 0:
                return stages, False, None

            # 3. DÉCOUVERTE APP
            found = find_app_module(root, py_files)
            stages.append({"stage": "DÉCOUVERTE", "state": "PASS" if found else "FAIL",
                           "detail": f"module {found[0]}:{found[1]} (FastAPI/create_app)" if found else "aucun module avec instance FastAPI( ou create_app( au niveau racine", "ms": 0})
            if not found:
                return stages, False, None

            # 4+5. BOOT + SONDES + OPENAPI
            port = free_port()
            boot_stages, proc, openapi = boot_and_probe(root, found[0], found[1], port, boot_wait)
            stages.extend(boot_stages)
        else:
            stages.append({"stage": "BOOT", "state": "SKIP",
                           "detail": f"stack {kind} : boot hors périmètre v1 de la porte (sandbox Docker = forme complète, frontière INV-215)", "ms": 0})

        passed = all(s["state"] != "FAIL" for s in stages)
        return stages, passed, openapi
    finally:
        terminate(proc)


def main():
    ap = argparse.ArgumentParser(description="PTA-001 — porte de boot (EVO-000016)")
    ap.add_argument("target", help="répertoire projet ou fichier .zip")
    ap.add_argument("--json", dest="json_out", help="écrire le rapport JSON complet ici")
    ap.add_argument("--label", default="", help="étiquette du sujet (ex : RUN-000021 original)")
    ap.add_argument("--env", action="append", default=[], help="variable d'environnement KEY=VAL pour le boot")
    ap.add_argument("--expect", choices=["PASS", "FAIL"], help="verdict attendu (mode calibrage)")
    ap.add_argument("--boot-wait", type=int, default=30, help="fenêtre de boot en secondes (défaut 30)")
    args = ap.parse_args()

    for kv in args.env:
        k, _, v = kv.partition("=")
        os.environ[k.strip()] = v.strip()

    tmp = None
    root = args.target
    if args.target.lower().endswith(".zip"):
        tmp = tempfile.mkdtemp(prefix="pta-gate-")
        with zipfile.ZipFile(args.target) as z:
            z.extractall(tmp)
        # si le zip a un dossier racine unique, descendre dedans
        entries = [e for e in os.listdir(tmp) if not e.startswith("__MACOSX")]
        if len(entries) == 1 and os.path.isdir(os.path.join(tmp, entries[0])):
            root = os.path.join(tmp, entries[0])
        else:
            root = tmp

    t0 = time.monotonic()
    try:
        stages, passed, openapi = gate(root, args.label, args.boot_wait, args.env)
    finally:
        if tmp:
            shutil.rmtree(tmp, ignore_errors=True)
    total_ms = int((time.monotonic() - t0) * 1000)

    report = {
        "gate": "PTA-001/EVO-000016-boot-gate",
        "version": "1.1",
        "version": "1.0",
        "ts": now_iso(),
        "label": args.label or args.target,
        "target": args.target,
        "passed": passed,
        "verdict": "PASS" if passed else "FAIL",
        "totalMs": total_ms,
        "openapi": openapi,
        "stages": stages,
    }
    line = " │ ".join(f"{s['stage']}:{s['state']}" for s in stages)
    print(f"[PTA-GATE] {report['label']} → {report['verdict']} ({total_ms} ms) │ {line}")
    for s in stages:
        if s["state"] == "FAIL":
            print(f"           └─ {s['stage']} : {s['detail'][:400]}")
    if args.json_out:
        with open(args.json_out, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2)

    if args.expect:
        ok = (args.expect == "PASS") == passed
        print(f"[PTA-GATE] calibrage : attendu {args.expect}, obtenu {report['verdict']} → {'CONFORME' if ok else 'DIVERGENCE'}")
        sys.exit(0 if ok else 1)
    sys.exit(0 if passed else 1)


if __name__ == "__main__":
    main()
