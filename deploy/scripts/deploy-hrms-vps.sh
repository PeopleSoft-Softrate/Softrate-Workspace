#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="193.203.161.48"
VPS_USER="root"
REMOTE_DIR="/opt/softrate-workspace"

echo "Deploying PeopleSoft HRMS backend to $VPS_USER@$VPS_HOST:$REMOTE_DIR/services/hrms Multi-terent ..."

# 1. Sync HRMS files to VPS
echo "Syncing HRMS backend files..."
rsync -avz --delete \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="dist" \
  --exclude=".DS_Store" \
  -e "ssh -o StrictHostKeyChecking=accept-new" \
  "services/hrms Multi-terent/" "$VPS_USER@$VPS_HOST:$REMOTE_DIR/services/hrms Multi-terent/"

# 2. Rebuild and restart only hrms-api Docker container on VPS
echo "Rebuilding and restarting hrms-api service on VPS..."
ssh -o StrictHostKeyChecking=accept-new "$VPS_USER@$VPS_HOST" "cd \"$REMOTE_DIR\" && docker compose up --build --no-deps -d hrms-api"

echo "HRMS backend deployment complete! ✅"
