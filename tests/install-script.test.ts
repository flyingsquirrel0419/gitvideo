import * as fs from 'node:fs';
import * as path from 'node:path';
import { describe, expect, it } from 'vitest';

const installScript = fs.readFileSync(path.resolve('scripts/install.sh'), 'utf8');

describe('install.sh', () => {
  it('installs gitvideo as one direct executable symlink instead of npm link', () => {
    expect(installScript).not.toContain('npm link');
    expect(installScript).not.toContain('CURRENT_LINK=');
    expect(installScript).toContain('APP_BIN="$APP_DIR/dist/index.js"');
    expect(installScript).toContain('ln -sfn "$APP_BIN" "$GLOBAL_BIN_DIR/gitvideo"');
  });
});
