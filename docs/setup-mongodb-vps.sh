#!/bin/bash
# =============================================================================
# setup-mongodb-vps.sh
# =============================================================================
# Run this on your Hostinger VPS to set up a dedicated MongoDB instance
# for Softrate, safely alongside any existing MongoDB on the server.
#
# What it does:
#   1. Checks what port the existing MongoDB is running on
#   2. Finds a free port (starts from 27018 if 27017 is taken)
#   3. Installs MongoDB 7.x if not already installed
#   4. Creates a separate systemd service (mongod-softrate) on the free port
#   5. Uses a dedicated data directory (/var/lib/mongodb-softrate)
#   6. Prints the MONGO_URI to put in your .env
#
# Usage:
#   chmod +x setup-mongodb-vps.sh
#   sudo bash setup-mongodb-vps.sh
# =============================================================================

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()    { echo -e "${GREEN}[INFO]${NC} $*"; }
warn()    { echo -e "${YELLOW}[WARN]${NC} $*"; }
error()   { echo -e "${RED}[ERR ]${NC} $*"; exit 1; }

# ------------------------------------------------------------------
# 1. Detect existing MongoDB port
# ------------------------------------------------------------------
info "Checking for existing MongoDB instances..."

EXISTING_PORT=""
for port in 27017 27018 27019; do
  if ss -tlnp | grep -q ":${port}"; then
    EXISTING_PORT="${port}"
    warn "MongoDB (or something) is already listening on port ${port}"
  fi
done

if [ -z "$EXISTING_PORT" ]; then
  info "No existing MongoDB detected — will use default port 27017"
  SOFTRATE_PORT=27017
else
  info "Detected existing service on ${EXISTING_PORT}"
fi

# ------------------------------------------------------------------
# 2. Find a free port for Softrate MongoDB
# ------------------------------------------------------------------
find_free_port() {
  local start=$1
  local port=$start
  while ss -tlnp | grep -q ":${port}"; do
    port=$((port + 1))
    if [ $port -gt 28000 ]; then
      error "Could not find a free port between ${start} and 28000"
    fi
  done
  echo $port
}

if [ -z "$SOFTRATE_PORT" ]; then
  SOFTRATE_PORT=$(find_free_port 27018)
  info "Will configure Softrate MongoDB on port: ${SOFTRATE_PORT}"
else
  info "Using port ${SOFTRATE_PORT} for Softrate MongoDB"
fi

# ------------------------------------------------------------------
# 3. Install MongoDB 7.x if mongod is not installed
# ------------------------------------------------------------------
if ! command -v mongod &>/dev/null; then
  info "mongod not found — installing MongoDB 7.x..."

  # Detect OS
  if [ -f /etc/debian_version ]; then
    info "Detected Debian/Ubuntu"
    apt-get update -qq
    apt-get install -y gnupg curl

    curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | \
      gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor

    OS_CODENAME=$(. /etc/os-release && echo "$VERSION_CODENAME")
    echo "deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] \
      https://repo.mongodb.org/apt/ubuntu ${OS_CODENAME}/mongodb-org/7.0 multiverse" \
      > /etc/apt/sources.list.d/mongodb-org-7.0.list

    apt-get update -qq
    apt-get install -y mongodb-org
    info "MongoDB installed successfully"
  else
    error "Non-Debian OS detected. Please install MongoDB manually from https://www.mongodb.org/try/download/community"
  fi
else
  MONGO_VER=$(mongod --version | head -1)
  info "MongoDB already installed: ${MONGO_VER}"
fi

# ------------------------------------------------------------------
# 4. Set up dedicated data + log directories for Softrate
# ------------------------------------------------------------------
SOFTRATE_DBPATH="/var/lib/mongodb-softrate"
SOFTRATE_LOGPATH="/var/log/mongodb-softrate"
SOFTRATE_CONF="/etc/mongod-softrate.conf"
SOFTRATE_SERVICE="mongod-softrate"

info "Creating directories..."
mkdir -p "${SOFTRATE_DBPATH}"
mkdir -p "${SOFTRATE_LOGPATH}"
chown -R mongodb:mongodb "${SOFTRATE_DBPATH}" 2>/dev/null || chown -R $(whoami):$(whoami) "${SOFTRATE_DBPATH}"
chown -R mongodb:mongodb "${SOFTRATE_LOGPATH}" 2>/dev/null || chown -R $(whoami):$(whoami) "${SOFTRATE_LOGPATH}"

# ------------------------------------------------------------------
# 5. Write dedicated mongod config for Softrate
# ------------------------------------------------------------------
info "Writing config: ${SOFTRATE_CONF}"
cat > "${SOFTRATE_CONF}" <<EOF
# Softrate dedicated MongoDB instance
systemLog:
  destination: file
  logAppend: true
  path: ${SOFTRATE_LOGPATH}/mongod.log

storage:
  dbPath: ${SOFTRATE_DBPATH}
  journal:
    enabled: true

processManagement:
  fork: false
  pidFilePath: /var/run/mongodb-softrate/mongod.pid
  timeZoneInfo: /usr/share/zoneinfo

net:
  port: ${SOFTRATE_PORT}
  bindIp: 127.0.0.1

# Uncomment to enable auth (recommended for production):
# security:
#   authorization: enabled
EOF

# ------------------------------------------------------------------
# 6. Create systemd service for Softrate MongoDB
# ------------------------------------------------------------------
info "Creating systemd service: ${SOFTRATE_SERVICE}"
mkdir -p /var/run/mongodb-softrate

cat > "/etc/systemd/system/${SOFTRATE_SERVICE}.service" <<EOF
[Unit]
Description=MongoDB Softrate Instance
After=network.target

[Service]
User=mongodb
Group=mongodb
ExecStart=/usr/bin/mongod --config ${SOFTRATE_CONF}
ExecStop=/bin/kill -SIGTERM \$MAINPID
Restart=always
RestartSec=5
LimitNOFILE=64000
RuntimeDirectory=mongodb-softrate
RuntimeDirectoryMode=0755

[Install]
WantedBy=multi-user.target
EOF

# ------------------------------------------------------------------
# 7. Enable and start the service
# ------------------------------------------------------------------
info "Enabling and starting ${SOFTRATE_SERVICE}..."
systemctl daemon-reload
systemctl enable "${SOFTRATE_SERVICE}"
systemctl start "${SOFTRATE_SERVICE}"

# Wait a moment and verify
sleep 3
if systemctl is-active --quiet "${SOFTRATE_SERVICE}"; then
  info "✅ ${SOFTRATE_SERVICE} is running on port ${SOFTRATE_PORT}"
else
  error "❌ Service failed to start. Check logs: journalctl -u ${SOFTRATE_SERVICE} -n 50"
fi

# ------------------------------------------------------------------
# 8. Firewall: Make sure port is NOT exposed externally
#    MongoDB should only be accessible from localhost (already bound to 127.0.0.1)
# ------------------------------------------------------------------
if command -v ufw &>/dev/null; then
  warn "UFW detected. MongoDB port ${SOFTRATE_PORT} is bound to 127.0.0.1 only — no firewall rule needed."
fi

# ------------------------------------------------------------------
# 9. Print result
# ------------------------------------------------------------------
echo ""
echo "========================================================"
echo -e "${GREEN}   ✅ Softrate MongoDB is ready!${NC}"
echo "========================================================"
echo ""
echo "  Service    : ${SOFTRATE_SERVICE}"
echo "  Port       : ${SOFTRATE_PORT}"
echo "  Data dir   : ${SOFTRATE_DBPATH}"
echo "  Log file   : ${SOFTRATE_LOGPATH}/mongod.log"
echo "  Config     : ${SOFTRATE_CONF}"
echo ""
echo "  Put this in your /services/sales/.env on the VPS:"
echo ""
echo -e "  ${YELLOW}MONGO_URI=mongodb://127.0.0.1:${SOFTRATE_PORT}/${NC}"
echo ""
echo "  Useful commands:"
echo "    sudo systemctl status ${SOFTRATE_SERVICE}"
echo "    sudo systemctl restart ${SOFTRATE_SERVICE}"
echo "    sudo journalctl -u ${SOFTRATE_SERVICE} -f"
echo "    mongosh --port ${SOFTRATE_PORT}"
echo ""
