#!/bin/sh
set -e

. /app/venv/bin/activate
cd /app/backend && python main.py --no-reload &
backend_pid=$!

for i in $(seq 1 90); do
  if ! kill -0 "$backend_pid" 2>/dev/null; then
    echo "Backend exited before becoming ready" >&2
    exit 1
  fi
  if curl -sf http://127.0.0.1:8000/health >/dev/null; then
    break
  fi
  sleep 1
done

if ! curl -sf http://127.0.0.1:8000/health >/dev/null; then
  echo "Backend did not become ready on :8000" >&2
  exit 1
fi

export PORT="${PORT:-8777}"
export HOSTNAME="${HOSTNAME:-0.0.0.0}"
cd /app/frontend && exec node server.js
