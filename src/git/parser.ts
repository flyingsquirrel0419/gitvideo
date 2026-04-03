import simpleGit, { type SimpleGit } from 'simple-git';
import { type ParseOptions, type RawCommit } from './types';

const LOG_FORMAT = ['%H', '%P', '%D', '%s', '%at', '%an', '%ae'].join('%x00');

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, '\\$&');
}

export function globToRegExp(pattern: string): RegExp {
  const regex = `^${escapeRegExp(pattern).replace(/\\\*/g, '.*')}$`;
  return new RegExp(regex);
}

function matchesAnyPattern(value: string, patterns: string[]): boolean {
  return patterns.some((pattern) => globToRegExp(pattern).test(value));
}

export class GitParser {
  private readonly git: SimpleGit;

  constructor(repoPath: string) {
    this.git = simpleGit(repoPath);
  }

  async parseAll(options: ParseOptions = {}): Promise<RawCommit[]> {
    const includedRefs = await this.getIncludedRefs(options.excludeBranches ?? []);
    if (includedRefs.length === 0) {
      throw new Error('No branches left to parse after applying exclude patterns.');
    }

    const rawLog = await this.git.raw([
      'log',
      '--topo-order',
      `--pretty=format:${LOG_FORMAT}`,
      ...includedRefs,
    ]);

    const commits = rawLog
      .split('\n')
      .map((line) => line.trimEnd())
      .filter((line) => line.length > 0)
      .map((line) => this.parseLine(line));

    return this.limitCommits(commits, options.maxCommits);
  }

  parseLine(line: string): RawCommit {
    const parts = line.split('\x00');
    const [sha = '', parentsRaw = '', refsRaw = '', message = '', timestampStr = '', authorName = '', authorEmail = ''] = parts;

    return {
      sha: sha.trim(),
      parentShas: parentsRaw
        .split(' ')
        .map((value) => value.trim())
        .filter(Boolean),
      refs: refsRaw
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => {
          if (value.startsWith('HEAD -> ')) {
            return value.replace('HEAD -> ', '');
          }
          if (value.startsWith('tag: ')) {
            return value.replace('tag: ', 'tag/');
          }
          return value;
        }),
      message: message.trim(),
      timestamp: Number.parseInt(timestampStr.trim(), 10),
      authorName: authorName.trim(),
      authorEmail: authorEmail.trim(),
    };
  }

  private async getIncludedRefs(excludeBranches: string[]): Promise<string[]> {
    const output = await this.git.raw([
      'for-each-ref',
      '--format=%(refname:short)',
      'refs/heads',
      'refs/remotes',
    ]);

    const allRefs = output
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .filter((ref) => !ref.endsWith('/HEAD'));

    if (excludeBranches.length === 0) {
      return allRefs;
    }

    return allRefs.filter((ref) => !matchesAnyPattern(ref, excludeBranches));
  }

  private limitCommits(commits: RawCommit[], maxCommits?: number): RawCommit[] {
    if (!maxCommits || maxCommits <= 0) {
      return commits;
    }
    return commits.slice(0, maxCommits);
  }
}
