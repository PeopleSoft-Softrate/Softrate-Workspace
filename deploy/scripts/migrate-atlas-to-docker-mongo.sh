#!/usr/bin/env bash
# =============================================================================
# migrate-to-dedicated-mongo.sh
#
# Migrates ONLY Softrate-owned databases from the shared 'we-crm-mongodb'
# container into the new dedicated 'mongo' container for Softrate Workspace.
#
# The correct Softrate Atlas connection string
ATLAS_URI="mongodb+srv://peoplesoft_db_user:xVttah0M8dAZHr69@cluster0.lztsvhx.mongodb.net/"
#
# Run this on the VPS AFTER docker compose up
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[INFO]${NC} $*"; }
error() { echo -e "${RED}[ERR ]${NC} $*"; exit 1; }

SOURCE_CONTAINER="we-crm-mongodb"
TARGET_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i mongo | grep softrate | head -1)

if [ -z "$TARGET_CONTAINER" ]; then
  error "Could not find the new dedicated Softrate mongo container."
fi

SOFTRATE_PREFIXES=("salesdb_" "peoplesoft_db" "sales_db")

info "Source: ${SOURCE_CONTAINER}"
info "Target: ${TARGET_CONTAINER}"

ALL_DBS=$(docker exec "${SOURCE_CONTAINER}" mongosh --quiet --eval "db.adminCommand({listDatabases:1}).databases.map(d=>d.name).join(' ')" 2>/dev/null)

MIGRATE_DBS=()
for DB in $ALL_DBS; do
  for prefix in "${SOFTRATE_PREFIXES[@]}"; do
    if [[ "$DB" == ${prefix}* ]]; then
      MIGRATE_DBS+=("$DB")
      break
    fi
  done
done

if [ ${#MIGRATE_DBS[@]} -eq 0 ]; then
  info "No Softrate databases found in ${SOURCE_CONTAINER} to migrate."
  exit 0
fi

info "Migrating: ${MIGRATE_DBS[*]}"

for DB in "${MIGRATE_DBS[@]}"; do
  info "--- Migrating: ${DB} ---"
  # Dump directly from source container to target container using docker exec piped to docker exec
  docker exec "${SOURCE_CONTAINER}" mongodump --db="${DB}" --archive | docker exec -i "${TARGET_CONTAINER}" mongorestore --uri="mongodb://softrate:changeme@127.0.0.1:27017/" --archive --drop --quiet
  info "  ✅ Done: ${DB}"
done

info "Migration complete! Deleting old databases from ${SOURCE_CONTAINER}..."
for DB in "${MIGRATE_DBS[@]}"; do
  docker exec "${SOURCE_CONTAINER}" mongosh "${DB}" --quiet --eval "db.dropDatabase()"
  info "  🗑️ Dropped: ${DB}"
done

echo ""
echo "🎉 Done! Restarting APIs..."
docker compose restart sales-api crm-api tickets-api hrms-api finance-api
echo "✅ All APIs restarted."
