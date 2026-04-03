import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { resolveAppConfig } from '../src/config';

const tempDirs: string[] = [];

function createRepo(branch = 'main'): string {
  const repoPath = fs.mkdtempSync(path.join(os.tmpdir(), 'gitvideo-config-'));
  tempDirs.push(repoPath);
  fs.mkdirSync(path.join(repoPath, '.git'), { recursive: true });
  fs.writeFileSync(path.join(repoPath, '.git', 'HEAD'), `ref: refs/heads/${branch}\n`);
  return repoPath;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('resolveAppConfig', () => {
  it('builds a default output filename from local repo and branch', () => {
    const repoPath = createRepo('feature/demo');
    const config = resolveAppConfig({
      repo: repoPath,
    });

    expect(path.basename(config.outputPath)).toMatch(/^gitvideo-config-[a-z0-9]+-feature-demo\.mp4$/);
  });

  it('builds a default output filename from github owner/repo', () => {
    const repoPath = createRepo();
    const config = resolveAppConfig({
      repo: repoPath,
      github: 'flyingsquirrel0419/gitvideo',
    });

    expect(path.basename(config.outputPath)).toBe('flyingsquirrel0419-gitvideo.mp4');
  });

  it('writes into output-dir when provided', () => {
    const repoPath = createRepo('main');
    const outputDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gitvideo-output-'));
    tempDirs.push(outputDir);

    const config = resolveAppConfig({
      repo: repoPath,
      outputDir,
    });

    expect(path.dirname(config.outputPath)).toBe(outputDir);
    expect(path.basename(config.outputPath)).toMatch(/^gitvideo-config-[a-z0-9]+-main\.mp4$/);
  });
});
