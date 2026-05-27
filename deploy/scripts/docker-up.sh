#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
ENV_FILE="${1:-$ROOT_DIR/.env.docker}"

cd "$ROOT_DIR"
docker compose --env-file "$ENV_FILE" up -d --build

