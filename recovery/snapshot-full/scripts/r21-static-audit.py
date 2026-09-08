#!/usr/bin/env python3
# Audit statique rapide RUN-000021 : fences markdown, imports, syntaxe
import ast, os, re, sys

ROOT = "/home/z/my-project/upload/RUN-000021-extract"

files = []
for dirpath, _, names in os.walk(ROOT):
    for n in names:
        files.append(os.path.join(dirpath, n))
files.sort()

fenced, clean, syntax_ok, syntax_fail = [], [], 0, []
imports = {}
for f in files:
    rel = os.path.relpath(f, ROOT)
    with open(f, encoding="utf-8", errors="replace") as fh:
        src = fh.read()
    if "```" in src:
        fenced.append(rel)
    else:
        clean.append(rel)
    # imports
    tops = re.findall(r"^(?:import|from)\s+([\w.]+)", src, re.M)
    if tops:
        imports[rel] = tops
    # syntaxe : brute puis dé-fencée
    cand = src
    m = re.search(r"```(?:python)?\n(.*?)```", src, re.S)
    stripped = m.group(1) if m else None
    try:
        ast.parse(cand)
        syntax_ok += 1
    except SyntaxError as e:
        if stripped:
            try:
                ast.parse(stripped)
                syntax_fail.append((rel, "OK après dé-fence (brut: ligne %s)" % e.lineno))
            except SyntaxError as e2:
                syntax_fail.append((rel, "ligne %s même dé-fencé: %s" % (e2.lineno, e2.msg)))
        else:
            syntax_fail.append((rel, "ligne %s: %s" % (e.lineno, e.msg)))

print(f"fichiers totaux      : {len(files)}")
print(f"avec fences markdown : {len(fenced)}")
print(f"propres (sans fence) : {len(clean)}")
print(f"compilables BRUTS    : {syntax_ok}")
print(f"échecs syntaxe       : {len(syntax_fail)}")
for rel, why in syntax_fail:
    tag = "→ dé-fençable" if "dé-fence" in why and why.startswith("OK") else "→ VRAI DÉFAUT"
    print(f"   {tag}: {rel} ({why})")

print("\n── imports entre fichiers (cross-imports locaux) ──")
local_names = {os.path.basename(f).replace(".py", "") for f in files}
local_names |= {os.path.basename(f) for f in files}
cross = {k: v for k, v in imports.items() if any(t.split(".")[0] in local_names and not t.split(".")[0].startswith(("abc","typing","dataclasses","enum","uuid","datetime","logging","json","hashlib","hmac","requests","decimal")) for t in v)}
if cross:
    for k, v in cross.items():
        print(f"   {os.path.basename(k)}: {v}")
else:
    print("   AUCUN cross-import entre fichiers-nœuds (chaque fichier est un îlot)")

print("\n── imports externes utilisés (top) ──")
ext = {}
for k, v in imports.items():
    for t in v:
        root_mod = t.split(".")[0]
        ext[root_mod] = ext.get(root_mod, 0) + 1
for m, c in sorted(ext.items(), key=lambda x: -x[1]):
    print(f"   {m}: {c}")
