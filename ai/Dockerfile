# Image for the SINARMS FastAPI AI engine.
# The multilingual MiniLM encoder is baked in at build time so the container
# needs no network on first boot (offline / air-gapped capable). The source
# tree is bind-mounted by docker-compose so app/ and models/ hot-reload.
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    HF_HOME=/opt/hf \
    SENTENCE_TRANSFORMERS_HOME=/opt/hf/sentence-transformers \
    HF_HUB_DISABLE_TELEMETRY=1 \
    AI_HOST=0.0.0.0 \
    AI_PORT=8000 \
    # watchfiles polling: bind-mount fs events are unreliable on Windows/macOS.
    WATCHFILES_FORCE_POLLING=true

# libgomp1 is required by the torch CPU runtime (OpenMP).
RUN apt-get update \
    && apt-get install -y --no-install-recommends libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# CPU-only torch keeps the image to a sane size — the default Linux wheel pulls
# ~2GB of CUDA libraries this project never uses.
RUN pip install torch==2.2.2 --index-url https://download.pytorch.org/whl/cpu

# Remaining deps from the project requirements (torch is already satisfied).
COPY requirements.txt ./
RUN pip install -r requirements.txt

# Bake the embedding model into the image. This is the only model fetched from
# HuggingFace at runtime; the fine-tuned DistilBERT path loads from local
# artifacts when present and otherwise falls back to these embeddings.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2')"

COPY . .

EXPOSE 8000

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]
