#!/bin/sh
set -eu

ensure_writable_dir() {
  dir="$1"

  mkdir -p "$dir"

  if ! su-exec vibeguard:nodejs sh -c 'test -w "$1"' sh "$dir"; then
    echo "[docker-entrypoint] Fixing permissions for $dir"
    chown -R vibeguard:nodejs "$dir"
    chmod -R u+rwX "$dir"
  fi
}

if [ "$(id -u)" = "0" ]; then
  ensure_writable_dir "/app/data/osv-cache"
  ensure_writable_dir "/app/data/osv-bootstrap"
  ensure_writable_dir "/app/data/enrichment-cache"

  exec su-exec vibeguard:nodejs "$@"
fi

exec "$@"
