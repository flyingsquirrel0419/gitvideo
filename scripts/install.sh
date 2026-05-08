#!/usr/bin/env bash
set -euo pipefail

DEFAULT_REPO_SLUG="flyingsquirrel0419/gitvideo"
REPO_SLUG="${GITVIDEO_REPO:-${1:-$DEFAULT_REPO_SLUG}}"
REQUESTED_TAG="${GITVIDEO_VERSION:-latest}"
INSTALL_ROOT="${GITVIDEO_INSTALL_ROOT:-$HOME/.gitvideo}"

log() {
  printf '[gitvideo] %s\n' "$1"
}

fail() {
  printf '[gitvideo] %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "Required command not found: $1"
  fi
}

add_brew_package() {
  local package="$1"
  case " ${BREW_PACKAGES[*]} " in
    *" $package "*) ;;
    *) BREW_PACKAGES+=("$package") ;;
  esac
}

require_cmd curl
require_cmd tar
require_cmd node
require_cmd npm

if [[ "$(uname -s)" != "Darwin" ]] && ! command -v ffmpeg >/dev/null 2>&1; then
  log "FFmpeg is not installed. Install it before generating video. On macOS: brew install ffmpeg"
fi

NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [[ "$NODE_MAJOR" -lt 18 ]]; then
  fail "Node.js 18 or newer is required."
fi
if [[ "$NODE_MAJOR" -ge 24 ]]; then
  fail "Node.js 24 is not supported yet because canvas does not ship a compatible prebuilt binary here. Use Node 20 or 22 LTS."
fi

if [[ "$(uname -s)" == "Darwin" ]]; then
  if ! command -v brew >/dev/null 2>&1; then
    fail "Homebrew is required on macOS. Install brew first, then rerun this installer."
  fi

  BREW_PACKAGES=()
  if ! command -v pkg-config >/dev/null 2>&1; then
    add_brew_package pkg-config
  fi

  if ! command -v ffmpeg >/dev/null 2>&1; then
    add_brew_package ffmpeg
  fi

  if ! command -v gh >/dev/null 2>&1; then
    add_brew_package gh
  fi

  if ! command -v pkg-config >/dev/null 2>&1 || ! pkg-config --exists pixman-1 cairo pangocairo librsvg-2.0; then
    add_brew_package cairo
    add_brew_package pango
    add_brew_package libpng
    add_brew_package jpeg
    add_brew_package giflib
    add_brew_package librsvg
    add_brew_package pixman
  fi

  if [[ "${#BREW_PACKAGES[@]}" -gt 0 ]]; then
    log "Installing macOS prerequisites: ${BREW_PACKAGES[*]}"
    brew install "${BREW_PACKAGES[@]}"
  fi
fi

resolve_latest_tag() {
  local api_url
  if [[ "$REQUESTED_TAG" == "latest" ]]; then
    api_url="https://api.github.com/repos/$REPO_SLUG/releases/latest"
  else
    api_url="https://api.github.com/repos/$REPO_SLUG/releases/tags/$REQUESTED_TAG"
  fi

  curl -fsSL "$api_url" | node -e '
let data = "";
process.stdin.on("data", (chunk) => { data += chunk; });
process.stdin.on("end", () => {
  const parsed = JSON.parse(data);
  if (!parsed.tag_name) {
    process.exit(1);
  }
  process.stdout.write(parsed.tag_name);
});
'
}

TAG="$(resolve_latest_tag)" || fail "Could not resolve a release tag for $REPO_SLUG"
ARCHIVE_URL="https://github.com/$REPO_SLUG/archive/refs/tags/$TAG.tar.gz"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

log "Downloading $REPO_SLUG@$TAG"
curl -fsSL "$ARCHIVE_URL" | tar -xz -C "$TMP_DIR"

SOURCE_DIR="$(find "$TMP_DIR" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
[[ -n "$SOURCE_DIR" ]] || fail "Failed to unpack release archive."

APP_DIR="$INSTALL_ROOT/$TAG"
mkdir -p "$INSTALL_ROOT"
rm -rf "$APP_DIR"
cp -R "$SOURCE_DIR" "$APP_DIR"
cd "$APP_DIR"

if [[ -f package-lock.json ]]; then
  log "Installing dependencies with npm ci"
  npm ci
else
  log "Installing dependencies"
  npm install
fi

log "Building project"
npm run build

NPM_PREFIX="$(npm config get prefix)"
TARGET_NODE_MODULES="$NPM_PREFIX/lib/node_modules"
if [[ ! -d "$TARGET_NODE_MODULES" || ! -w "$TARGET_NODE_MODULES" ]]; then
  export npm_config_prefix="$HOME/.local"
  mkdir -p "$HOME/.local"
  log "Using user npm prefix at $HOME/.local"
fi

log "Installing gitvideo command"
npm install -g "$APP_DIR"

printf '%s\n' "$REPO_SLUG" > "$INSTALL_ROOT/repo"
printf '%s\n' "$TAG" > "$INSTALL_ROOT/version"

GLOBAL_BIN_DIR="$(npm prefix -g)/bin"
case ":$PATH:" in
  *":$GLOBAL_BIN_DIR:"*) ;;
  *)
    log "Add this directory to your PATH if 'gitvideo' is not found: $GLOBAL_BIN_DIR"
    ;;
esac

if command -v gh >/dev/null 2>&1; then
  log "Run 'gitvideo auth login' before using --github"
else
  log "Optional: install GitHub CLI with 'brew install gh' to use 'gitvideo auth login'"
fi

log "Installed successfully. Run: gitvideo"
