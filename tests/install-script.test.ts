import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const installScript = fs.readFileSync(path.resolve('scripts/install.sh'), 'utf8');

describe('install.sh', () => {
  it('defaults to the official repo and installs gitvideo globally', () => {
    expect(installScript).toContain('DEFAULT_REPO_SLUG="flyingsquirrel0419/gitvideo"');
    expect(installScript).toContain('REPO_SLUG="${GITVIDEO_REPO:-${1:-$DEFAULT_REPO_SLUG}}"');
    expect(installScript).toContain('log "Installing macOS prerequisites: ${BREW_PACKAGES[*]}"');
    expect(installScript).toContain('brew install "${BREW_PACKAGES[@]}"');
    expect(installScript).toContain('log "Installing gitvideo command"');
    expect(installScript).toContain('npm install -g "$APP_DIR"');
    expect(installScript).not.toContain('Usage: curl .../install.sh | bash -s -- OWNER/REPO');
    expect(installScript).not.toContain('npm link');
    expect(installScript).not.toContain('APP_BIN="$APP_DIR/dist/index.js"');
  });
});
