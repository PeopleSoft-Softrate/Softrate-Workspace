#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_ROOT="${1:-/var/www/softrate}"

build_app() {
  local app_dir="$1"
  local base_href="$2"
  local output_dir="$3"

  echo "Building $app_dir -> $output_dir with base href $base_href"
  (
    cd "$ROOT_DIR/$app_dir"
    npm install
    npm run build -- --base-href "$base_href" --output-path "$output_dir"
  )
}

build_app "apps/sales/admin-crm" "/admin/" "$OUTPUT_ROOT/admin"
build_app "apps/sales/emp" "/sales/" "$OUTPUT_ROOT/sales"
build_app "apps/hrms/emp-hr" "/hrms/" "$OUTPUT_ROOT/hrms"
build_app "apps/tickets" "/tickets/" "$OUTPUT_ROOT/tickets"
build_app "apps/finance" "/finance/" "$OUTPUT_ROOT/finance"

echo "Frontend builds complete."
