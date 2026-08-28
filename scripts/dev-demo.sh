#!/usr/bin/env bash
set -euo pipefail

project_root="$(cd "$(dirname "$0")/.." && pwd)"
cd "$project_root"

export OSTERIE_PORT="${OSTERIE_PORT:-8787}"
export PORT="$OSTERIE_PORT"
export VITE_WS_URL="${VITE_WS_URL:-ws://localhost:${OSTERIE_PORT}/ws}"
export VITE_CONTROLLER_URL="${VITE_CONTROLLER_URL:-http://localhost:5174}"

children=()
cleanup() {
  for child in "${children[@]:-}"; do
    kill "$child" 2>/dev/null || true
  done
}
trap cleanup EXIT INT TERM

npm run dev -w @osterie/server & children+=("$!")
npm run dev -w @osterie/tv-web -- --host 0.0.0.0 --port 5173 & children+=("$!")
npm run dev -w @osterie/controller-web -- --host 0.0.0.0 --port 5174 & children+=("$!")

echo "TV:         http://localhost:5173/?room=ABCD"
echo "Controller: http://localhost:5174/join/ABCD"
echo "Server:     http://localhost:${OSTERIE_PORT}/health"

wait
