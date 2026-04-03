import { execFile, spawn } from 'node:child_process';

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
    const token = await execFileText('gh', ['auth', 'token']);
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

  await runInteractive('gh', ['auth', 'login', '--web', '--git-protocol', 'https', '-s', 'repo']);
}

export async function runGitHubStatus(): Promise<void> {
  if (!(await isGhInstalled())) {
    throw new Error('GitHub CLI is not installed. Install it with `brew install gh`.');
  }

  await runInteractive('gh', ['auth', 'status']);
}
