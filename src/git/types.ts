export interface RawCommit {
  sha: string;
  parentShas: string[];
  refs: string[];
  message: string;
  timestamp: number;
  authorName: string;
  authorEmail: string;
}

export interface BranchInfo {
  name: string;
  headSha: string;
  isRemote: boolean;
  isActive: boolean;
}

export interface ParseOptions {
  maxCommits?: number;
  excludeBranches?: string[];
}
