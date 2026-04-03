export interface CommitNode {
  sha: string;
  shortSha: string;
  parentShas: string[];
  childShas: string[];
  branchNames: string[];
  message: string;
  timestamp: number;
  authorName: string;
  authorEmail: string;
  isMerge: boolean;
  laneIndex: number;
  x: number;
  y: number;
}

export interface CommitEdge {
  fromSha: string;
  toSha: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isMerge: boolean;
  laneColor: string;
}

export interface CommitGraph {
  nodes: Map<string, CommitNode>;
  edges: CommitEdge[];
  orderedShas: string[];
  laneCount: number;
  totalWidth: number;
  totalHeight: number;
}
