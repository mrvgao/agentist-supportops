#!/usr/bin/env bash
set -euo pipefail
: "${MODEL_API_KEY:?Set MODEL_API_KEY on the GPU host}"
# Start only on the allocated NVIDIA GPU host. Model download requires disk space.
# Install vLLM into an isolated environment using its official compatible build.
exec vllm serve "${MODEL_PATH:-Qwen/Qwen2.5-7B-Instruct}" \
  --served-model-name support-agent --host 127.0.0.1 --port 8000 \
  --api-key "$MODEL_API_KEY" --max-model-len 12288 --gpu-memory-utilization 0.90 --enforce-eager
