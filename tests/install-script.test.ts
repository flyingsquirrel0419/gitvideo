import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const installScript = fs.readFileSync(path.resolve('scripts/install.sh'), 'utf8');

describe('install.sh', () => {
  it('installs gitvideo through npm link', () => {
    expect(installScript).toContain('log "Running npm link"');
    expect(installScript).toContain('npm link');
    expect(installScript).not.toContain('APP_BIN="$APP_DIR/dist/index.js"');
  });
});
