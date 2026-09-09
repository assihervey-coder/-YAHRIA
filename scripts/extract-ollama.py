#!/usr/bin/env python3.13
"""Extraction streamée de ollama-linux-amd64.tar.zst (~/.local) — zstd sans binaire système.
Mémoire bornée : décompression en flux + extraction tar en flux (jamais le fichier entier)."""
import tarfile
import io
import os
import zstandard

SRC = "/home/z/my-project/.ollama-dl/ollama.tar.zst"
DST = "/home/z/.local"

dctx = zstandard.ZstdDecompressor()
count = 0
with open(SRC, "rb") as fh:
    with dctx.stream_reader(fh) as reader:
        # stream_reader → flux tar brut ; tarfile lit en mode 'r|' (streaming)
        with tarfile.open(fileobj=reader, mode="r|") as tf:
            for member in tf:
                # sûreté : refuse les chemins absolus / traversée
                if member.name.startswith("/") or ".." in member.name:
                    raise SystemExit(f"chemin dangereux refusé : {member.name}")
                tf.extract(member, path=DST)
                count += 1
                if count % 20 == 0:
                    print(f"{count} entrées extraites…", flush=True)
print(f"OK — {count} entrées extraites dans {DST}")
bin_path = os.path.join(DST, "bin", "ollama")
print("binaire :", bin_path, "existe =", os.path.exists(bin_path))
if os.path.exists(bin_path):
    os.chmod(bin_path, 0o755)
    print("taille :", os.path.getsize(bin_path) // 1048576, "Mo")
