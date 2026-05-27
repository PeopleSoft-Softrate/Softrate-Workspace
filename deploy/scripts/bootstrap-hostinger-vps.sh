#!/usr/bin/env bash
set -euo pipefail

if [ "$(id -u)" -ne 0 ]; then
  echo "Run this script as root."
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive

apt-get update
apt-get install -y curl git nginx certbot python3-certbot-nginx build-essential

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
  apt-get install -y nodejs
fi

if ! command -v pm2 >/dev/null 2>&1; then
  npm install -g pm2
fi

mkdir -p /var/www/softrate
mkdir -p /var/log/softrate

echo "Bootstrap complete."
echo "Next steps:"
echo "1. Clone the repo on the VPS."
echo "2. Copy real .env files into each service directory."
echo "3. Build frontends with deploy/scripts/build-frontends.sh."
echo "4. Start APIs with: pm2 start deploy/pm2/ecosystem.config.cjs"
echo "5. Place docs/hostinger-nginx.conf into /etc/nginx/sites-available and adapt server_name."
echo "6. After DNS is mapped, issue HTTPS with certbot."
