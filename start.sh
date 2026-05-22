#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOG_DIR="$ROOT_DIR/.logs"

mkdir -p "$LOG_DIR"

PIDS=()
NAMES=()

ensure_deps() {
  local dir="$1"

  if [ ! -d "$dir/node_modules" ]; then
    echo "Installing dependencies in $dir"
    npm install
  fi
}

start_process() {
  local name="$1"
  local dir="$2"
  local port="$3"
  shift 3

  echo "Starting $name on port $port"
  (
    cd "$ROOT_DIR/$dir"
    ensure_deps "$PWD"
    "$@"
  ) > "$LOG_DIR/$name.log" 2>&1 &

  PIDS+=("$!")
  NAMES+=("$name")
}

start_frontend() {
  local name="$1"
  local dir="$2"
  local port="$3"
  shift 3

  start_process "$name" "$dir" "$port" npm start -- "$@"
}

start_service() {
  local name="$1"
  local dir="$2"
  local port="$3"
  local port_var="$4"

  start_process "$name" "$dir" "$port" env "$port_var=$port" npm start
}

cleanup() {
  if [ "${#PIDS[@]}" -gt 0 ]; then
    echo
    echo "Stopping workspace processes..."
    for pid in "${PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
  fi
}

trap cleanup INT TERM EXIT

start_frontend "admin-crm" "apps/sales/admin-crm" "4200" --host 0.0.0.0 --port 4200
start_frontend "emp" "apps/sales/emp" "4201" --host 0.0.0.0 --port 4201
start_frontend "finance-ui" "apps/finance" "4202" --host 0.0.0.0 --port 4202
start_frontend "tickets-ui" "apps/tickets" "4203" --host 0.0.0.0
start_frontend "emp-hr" "apps/hrms/emp-hr" "4204" --host 0.0.0.0 --port 4204

start_service "sales-api" "services/sales" "4000" "PORT"
start_service "crm-api" "services/crm" "4100" "CRM_PORT"
start_service "tickets-api" "services/tickets" "4300" "TICKETS_PORT"
start_service "finance-api" "services/finance" "4400" "FINANCE_PORT"
start_service "hrms-api" "services/hrms" "5001" "PORT"

cat <<INFO

Softrate Workspace is starting.

Frontends:
  admin-crm  http://localhost:4200
  emp        http://localhost:4201
  finance   http://localhost:4202
  tickets   http://localhost:4203
  emp-hr     http://localhost:4204

Services:
  sales      http://localhost:4000
  crm        http://localhost:4100
  tickets    http://localhost:4300
  finance    http://localhost:4400
  hrms       http://localhost:5001

Logs:
  $LOG_DIR

Press Ctrl-C to stop all processes.

INFO

while true; do
  for i in "${!PIDS[@]}"; do
    if ! kill -0 "${PIDS[$i]}" 2>/dev/null; then
      echo "${NAMES[$i]} stopped. Check $LOG_DIR/${NAMES[$i]}.log"
      exit 1
    fi
  done
  sleep 2
done
