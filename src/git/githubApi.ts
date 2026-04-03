import { Octokit } from '@octokit/rest';
import { globToRegExp } from './parser';
import { type ParseOptions, type RawCommit } from './types';

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export class GitHubApiParser {
  private readonly octokit: Octokit;

  constructor(token?: string) {
    this.octokit = new Octokit(token ? { auth: token } : {});
  }

  async parseAll(owner: string, repo: string, options: ParseOptions = {}): Promise<RawCommit[]> {
    const branches = await this.octokit.paginate(this.octokit.repos.listBranches, {
      owner,
      repo,
      per_page: 100,
    });

    const excludeMatchers = (options.excludeBranches ?? []).map((pattern) => globToRegExp(pattern));
    const includedBranches = branches.filter((branch) => {
      return !excludeMatchers.some((matcher) => matcher.test(branch.name));
    });

    if (includedBranches.length === 0) {
      throw new Error('No branches left to parse after applying exclude patterns.');
    }

    const commitMap = new Map<string, RawCommit>();

    for (const branch of includedBranches) {
      const commits = await this.octokit.paginate(this.octokit.repos.listCommits, {
        owner,
        repo,
        sha: branch.name,
        per_page: 100,
      });

      for (const commit of commits) {
        const existing = commitMap.get(commit.sha);
        const branchRef = branch.commit.sha === commit.sha ? branch.name : null;

        if (existing) {
          if (branchRef) {
            existing.refs = dedupe([...existing.refs, branchRef]);
          }
          continue;
        }

        commitMap.set(commit.sha, {
          sha: commit.sha,
          parentShas: commit.parents.map((parent) => parent.sha),
          refs: branchRef ? [branchRef] : [],
          message: commit.commit.message.split('\n')[0] ?? '',
          timestamp: Math.floor(new Date(commit.commit.author?.date ?? 0).getTime() / 1000),
          authorName: commit.commit.author?.name ?? '',
          authorEmail: commit.commit.author?.email ?? '',
        });
      }
    }

    const commits = Array.from(commitMap.values()).sort((left, right) => right.timestamp - left.timestamp);
    if (options.maxCommits && options.maxCommits > 0) {
      return commits.slice(0, options.maxCommits);
    }
    return commits;
  }
}
