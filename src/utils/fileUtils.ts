import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

export function ensureDir(dirPath: string): void {
  fs.mkdirSync(dirPath, { recursive: true });
}

export function removeDir(dirPath: string): void {
  fs.rmSync(dirPath, { recursive: true, force: true });
}

export function createTempDir(prefix = 'gitvideo'): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), `${prefix}-`));
}
