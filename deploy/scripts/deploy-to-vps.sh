#!/usr/bin/env bash
set -euo pipefail

VPS_HOST="193.203.161.48"
VPS_USER="root"
REMOTE_DIR="/opt/softrate-workspace"

echo "Deploying Softrate Workspace to $VPS_USER@$VPS_HOST:$REMOTE_DIR using Docker Compose..."

# 1. Sync files to VPS
echo "Syncing files..."
rsync -avz --delete \
  --exclude="node_modules" \
  --exclude=".git" \
  --exclude="dist" \
  --exclude=".angular" \
  --exclude="deploy/certbot/conf" \
  --exclude="deploy/certbot/www" \
  --exclude=".DS_Store" \
  --exclude="mobile-apps" \
  -e "ssh -o StrictHostKeyChecking=accept-new" \
  ./ $VPS_USER@$VPS_HOST:$REMOTE_DIR

# 2. Rebuild and start Docker containers on VPS
echo "Starting Docker services on VPS..."
ssh -o StrictHostKeyChecking=accept-new $VPS_USER@$VPS_HOST << 'EOF'
  cd /opt/softrate-workspace
  
  # Make sure Docker is installed
  if ! command -v docker >/dev/null 2>&1; then
    echo "Docker is not installed. Installing Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
  fi
  
  if ! command -v docker compose >/dev/null 2>&1; then
    echo "Docker Compose is not installed. Installing Docker Compose plugin..."
    apt-get update && apt-get install -y docker-compose-plugin || true
  fi

  # Make sure certbot directories exist
  mkdir -p deploy/certbot/conf
  mkdir -p deploy/certbot/www

  # Stop existing containers if any and restart
  echo "Rebuilding and starting containers..."
  docker compose up --build -d
EOF

echo "Deployment complete! ✅"
