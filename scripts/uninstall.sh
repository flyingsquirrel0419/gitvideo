#!/usr/bin/env bash
set -euo pipefail

INSTALL_ROOT="${GITVIDEO_INSTALL_ROOT:-$HOME/.gitvideo}"

log() {
  printf '[gitvideo] %s\n' "$1"
}

run_unlink() {
  local prefix="$1"
  if [[ -z "$prefix" ]]; then
    return 0
  fi

  if [[ ! -d "$prefix" ]]; then
    return 0
  fi

  if npm_config_prefix="$prefix" npm ls -g gitvideo >/dev/null 2>&1; then
    log "Removing global package from $prefix"
    npm_config_prefix="$prefix" npm uninstall -g gitvideo >/dev/null 2>&1 || true
  fi

  rm -f "$prefix/bin/gitvideo"
  rm -rf "$prefix/lib/node_modules/gitvideo"
}

DEFAULT_PREFIX="$(npm config get prefix 2>/dev/null || true)"
run_unlink "$DEFAULT_PREFIX"
run_unlink "$HOME/.local"

if [[ -e "$INSTALL_ROOT" ]]; then
  log "Removing installed files from $INSTALL_ROOT"
  rm -rf "$INSTALL_ROOT"
fi

log "Uninstall complete."
