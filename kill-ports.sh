#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCRIPT_PATH="$ROOT_DIR/$(basename "${BASH_SOURCE[0]}")"

DRY_RUN=false
PORTS=()

usage() {
  cat <<USAGE
Usage: ./kill-ports.sh [--dry-run] [port ...]

Without explicit ports, this scans project .sh files and kills listeners on
ports referenced by those scripts.

Options:
  --dry-run  Show which ports and PIDs would be killed without killing them.
  -h, --help Show this help text.
USAGE
}

is_port() {
  local value="$1"
  [[ "$value" =~ ^[0-9]+$ ]] && [ "$value" -ge 1024 ] && [ "$value" -le 65535 ]
}

add_port() {
  local port="$1"

  if is_port "$port"; then
    PORTS+=("$port")
  fi
}

extract_ports_from_line() {
  local rest="$1"
  local match

  while [[ "$rest" =~ --port[=\ ]+([0-9]{2,5}) ]]; do
    add_port "${BASH_REMATCH[1]}"
    match="${BASH_REMATCH[0]}"
    rest="${rest#*"$match"}"
  done

  rest="$1"
  while [[ "$rest" =~ localhost:([0-9]{2,5}) ]]; do
    add_port "${BASH_REMATCH[1]}"
    match="${BASH_REMATCH[0]}"
    rest="${rest#*"$match"}"
  done

  rest="$1"
  while [[ "$rest" =~ [A-Z_]*PORT[A-Z_]*=([0-9]{2,5}) ]]; do
    add_port "${BASH_REMATCH[1]}"
    match="${BASH_REMATCH[0]}"
    rest="${rest#*"$match"}"
  done

  rest="$1"
  while [[ "$rest" =~ [\"\']([0-9]{4,5})[\"\'] ]]; do
    add_port "${BASH_REMATCH[1]}"
    match="${BASH_REMATCH[0]}"
    rest="${rest#*"$match"}"
  done
}

discover_ports() {
  local file line

  while IFS= read -r -d '' file; do
    while IFS= read -r line || [ -n "$line" ]; do
      extract_ports_from_line "$line"
    done < "$file"
  done < <(
    find "$ROOT_DIR" \
      \( \
        -type d \( \
          -name '.git' -o \
          -name 'node_modules' -o \
          -name '.angular' -o \
          -name 'dist' -o \
          -name 'build' -o \
          -name '.venv' \
        \) \
      \) -prune -o \
      -type f -name '*.sh' ! -path "$SCRIPT_PATH" -print0
  )
}

unique_ports() {
  printf '%s\n' "${PORTS[@]}" | awk '!seen[$0]++' | sort -n
}

listener_pids_for_port() {
  local port="$1"
  lsof -tiTCP:"$port" -sTCP:LISTEN 2>/dev/null || true
}

kill_port() {
  local port="$1"
  local pids
  local remaining

  pids="$(listener_pids_for_port "$port")"

  if [ -z "$pids" ]; then
    echo "Port $port: no listener"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "Port $port: would kill PID(s) ${pids//$'\n'/ }"
    return
  fi

  echo "Port $port: killing PID(s) ${pids//$'\n'/ }"
  kill $pids 2>/dev/null || true
  sleep 1

  remaining="$(listener_pids_for_port "$port")"
  if [ -n "$remaining" ]; then
    echo "Port $port: force killing PID(s) ${remaining//$'\n'/ }"
    kill -9 $remaining 2>/dev/null || true
  fi
}

for arg in "$@"; do
  case "$arg" in
    --dry-run)
      DRY_RUN=true
      ;;
    -h | --help)
      usage
      exit 0
      ;;
    *)
      if ! is_port "$arg"; then
        echo "Invalid port: $arg" >&2
        usage >&2
        exit 2
      fi
      add_port "$arg"
      ;;
  esac
done

if [ "${#PORTS[@]}" -eq 0 ]; then
  discover_ports
fi

if [ "${#PORTS[@]}" -eq 0 ]; then
  echo "No ports found."
  exit 0
fi

if ! command -v lsof >/dev/null 2>&1; then
  echo "lsof is required to find processes by port." >&2
  exit 1
fi

while IFS= read -r port; do
  [ -n "$port" ] || continue
  kill_port "$port"
done < <(unique_ports)
