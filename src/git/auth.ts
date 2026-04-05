import { execFile, spawn } from 'node:child_process';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';

function execFileText(command: string, args: string[]): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(command, args, { encoding: 'utf8' }, (error, stdout) => {
      if (error) {
        reject(error);
        return;
      }
      resolve(stdout.trim());
    });
  });
}

async function isGhInstalled(): Promise<boolean> {
  try {
    await execFileText('gh', ['--version']);
    return true;
  } catch {
    return false;
  }
}

export function parseGhStatusToken(output: string): string | undefined {
  for (const line of output.split('\n')) {
    const match = line.match(/Token:\s+(\S+)/);
    if (match?.[1]) {
      return match[1];
    }
  }

  return undefined;
}

function readTokenFromGhHostsFile(): string | undefined {
  try {
    const hostsPath = path.join(os.homedir(), '.config', 'gh', 'hosts.yml');
    if (!fs.existsSync(hostsPath)) {
      return undefined;
    }

    const content = fs.readFileSync(hostsPath, 'utf8');
    const match = content.match(/oauth_token:\s+(\S+)/);
    return match?.[1];
  } catch {
    return undefined;
  }
}

export async function resolveGitHubToken(explicitToken?: string): Promise<string> {
  if (explicitToken) {
    return explicitToken;
  }

  const envToken = process.env.GITHUB_TOKEN ?? process.env.GH_TOKEN;
  if (envToken) {
    return envToken;
  }

  if (!(await isGhInstalled())) {
    throw new Error(
      'GitHub login is required for --github. Install GitHub CLI (`brew install gh`) and run `gitvideo auth login`, or pass --token.',
    );
  }

  try {
    let token: string | undefined;

    try {
      token = await execFileText('gh', ['auth', 'token']);
    } catch {
      const statusOutput = await execFileText('gh', ['auth', 'status', '--show-token']);
      token = parseGhStatusToken(statusOutput) ?? readTokenFromGhHostsFile();
    }

    if (!token) {
      throw new Error('empty token');
    }
    return token;
  } catch {
    throw new Error(
      'GitHub CLI is not authenticated. Run `gitvideo auth login` first, or pass --token.',
    );
  }
}

function runInteractive(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('close', (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} exited with code ${code}`));
    });
  });
}

export async function runGitHubLogin(): Promise<void> {
  if (!(await isGhInstalled())) {
    throw new Error('GitHub CLI is not installed. Install it with `brew install gh`.');
  }

  await runInteractive('gh', ['auth', 'login', '--web', '-s', 'repo']);
}

export async function runGitHubStatus(): Promise<void> {
  if (!(await isGhInstalled())) {
    throw new Error('GitHub CLI is not installed. Install it with `brew install gh`.');
  }

  await runInteractive('gh', ['auth', 'status']);
}
