# Clawix TTS (Piper) sidecar — self-hosted text-to-speech, no vendor API key.
# Internal-only service: called by the API server over the compose network at
# TTS_PIPER_URL, never exposed to the host or internet directly.
# Build: docker build -t clawix-tts:latest -f infra/docker/tts/Dockerfile .

FROM node:22-slim

# Piper release + voice model pin. Bump PIPER_VERSION and re-check the asset
# name at https://github.com/rhasspy/piper/releases if this ever needs updating.
ARG PIPER_VERSION=2023.11.14-2
ARG VOICE=en_US-lessac-medium

RUN apt-get update && apt-get install -y --no-install-recommends \
        curl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

RUN curl -fsSL -o /tmp/piper.tar.gz \
        "https://github.com/rhasspy/piper/releases/download/${PIPER_VERSION}/piper_linux_x86_64.tar.gz" \
    && tar -xzf /tmp/piper.tar.gz -C /app \
    && rm /tmp/piper.tar.gz

RUN mkdir -p /app/voices \
    && curl -fsSL -o "/app/voices/${VOICE}.onnx" \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/${VOICE}.onnx" \
    && curl -fsSL -o "/app/voices/${VOICE}.onnx.json" \
        "https://huggingface.co/rhasspy/piper-voices/resolve/main/en/en_US/lessac/medium/${VOICE}.onnx.json"

ENV PATH="/app/piper:${PATH}"
ENV PIPER_MODEL_PATH="/app/voices/${VOICE}.onnx"
ENV PORT=5001

COPY infra/docker/tts/server.js /app/server.js

HEALTHCHECK --interval=10s --timeout=3s --retries=5 \
    CMD node -e "fetch('http://localhost:5001/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

EXPOSE 5001
CMD ["node", "/app/server.js"]
