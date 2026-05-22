#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="$ROOT_DIR/.logs"

mkdir -p "$LOG_DIR"

PIDS=()
NAMES=()
FRONTEND_LINES=()
SERVICE_LINES=()

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

  FRONTEND_LINES+=("  $name  http://localhost:$port")
  start_process "$name" "$dir" "$port" npm start -- "$@"
}

start_service() {
  local name="$1"
  local dir="$2"
  local port="$3"
  local port_var="$4"

  SERVICE_LINES+=("  $name  http://localhost:$port")
  start_process "$name" "$dir" "$port" env "$port_var=$port" npm start
}

cleanup() {
  if [ "${#PIDS[@]}" -gt 0 ]; then
    echo
    echo "Stopping app processes..."
    for pid in "${PIDS[@]}"; do
      kill "$pid" 2>/dev/null || true
    done
    wait 2>/dev/null || true
  fi
}

print_info() {
  local title="$1"

  echo
  echo "$title is starting."
  echo
  echo "Frontend:"
  printf '%s\n' "${FRONTEND_LINES[@]}"
  echo
  echo "Services:"
  printf '%s\n' "${SERVICE_LINES[@]}"
  echo
  echo "Logs:"
  echo "  $LOG_DIR"
  echo
  echo "Press Ctrl-C to stop these processes."
  echo
}

watch_processes() {
  while true; do
    for i in "${!PIDS[@]}"; do
      if ! kill -0 "${PIDS[$i]}" 2>/dev/null; then
        echo "${NAMES[$i]} stopped. Check $LOG_DIR/${NAMES[$i]}.log"
        exit 1
      fi
    done
    sleep 2
  done
}

start_sales() {
    start_frontend "admin-crm" "apps/sales/admin-crm" "4200" --host 0.0.0.0 --port 4200
    start_frontend "emp" "apps/sales/emp" "4201" --host 0.0.0.0 --port 4201
    start_service "sales-api" "services/sales" "4000" "PORT"
    start_service "crm-api" "services/crm" "4100" "CRM_PORT"
}

start_finance() {
    start_frontend "finance" "apps/finance" "4202" --host 0.0.0.0 --port 4202
    start_service "finance-api" "services/finance" "4400" "FINANCE_PORT"
}

start_tickets() {
    start_frontend "tickets" "apps/tickets" "4203" --host 0.0.0.0 --port 4203
    start_service "tickets-api" "services/tickets" "4300" "TICKETS_PORT"
}

start_hrms() {
    start_frontend "emp-hr" "apps/hrms/emp-hr" "4204" --host 0.0.0.0 --port 4204
    start_service "hrms-api" "services/hrms" "5001" "PORT"
}

trap cleanup INT TERM EXIT

case "${1:-all}" in
  all)
    start_sales
    start_finance
    start_tickets
    start_hrms
    print_info "Softrate Workspace"
    ;;
  sales | crm | admin | emp)
    start_sales
    print_info "Softrate Sales"
    ;;
  finance)
    start_finance
    print_info "Softrate Finance"
    ;;
  tickets)
    start_tickets
    print_info "Softrate Tickets"
    ;;
  hrms | emp-hr)
    start_hrms
    print_info "Softrate HRMS"
    ;;
  *)
    cat <<USAGE
Usage: scripts/start-app.sh [app]

Apps:
  all       all frontends and all related APIs
  sales    admin CRM + employee frontends, sales API, CRM API
  finance  finance frontend + finance API
  tickets  client ticket frontend + tickets API
  hrms     HRMS employee frontend + HRMS API
USAGE
    exit 2
    ;;
esac

watch_processes
