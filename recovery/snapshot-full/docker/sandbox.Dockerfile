# ═══════════════════════════════════════════════════════════════
# YAHRIA — image sandbox durcie (INV-215)
# Lancée par le backend d'exécution conteneur :
#   YAHRIA_SANDBOX_BACKEND=docker  YAHRIA_SANDBOX_IMAGE=yahria-sandbox:latest
# Chaque étape sandbox tourne alors dans un conteneur :
#   --network none --read-only --cap-drop ALL --cpus 1 --memory 512m
#   --pids-limit 128 --tmpfs /tmp  (voir sandbox-executor.ts)
# Build : docker build -f docker/sandbox.Dockerfile -t yahria-sandbox:latest .
# Toolchains inclus : gcc/g++/make, gfortran, Python 3, Node, dotnet 8, mono (mcs).
# ═══════════════════════════════════════════════════════════════
FROM ubuntu:24.04
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
      ca-certificates curl bash \
      build-essential gfortran \
      python3 python3-venv \
      nodejs npm \
      dotnet-sdk-8.0 \
      mono-mcs mono-runtime \
    && rm -rf /var/lib/apt/lists/*
RUN useradd -m -u 1000 yahria && mkdir -p /work && chown yahria:yahria /work
USER yahria
WORKDIR /work
CMD ["bash"]
