#!/bin/sh
set -eu

NODE24_BIN="/opt/homebrew/opt/node@24/bin/node"
ANGULAR_CLI="./node_modules/@angular/cli/bin/ng"

if [ -x "$NODE24_BIN" ]; then
  NODE_BIN="$NODE24_BIN"
else
  NODE_BIN="node"
fi

export NG_CLI_ANALYTICS=false
exec "$NODE_BIN" "$ANGULAR_CLI" "$@"
