import { type RawCommit } from '../git/types';
import { type CommitGraph, type CommitNode } from './types';

function dedupe(values: string[]): string[] {
  return Array.from(new Set(values));
}

export class DAGBuilder {
  build(rawCommits: RawCommit[]): CommitGraph {
    const nodes = new Map<string, CommitNode>();

    for (const raw of rawCommits) {
      nodes.set(raw.sha, {
        sha: raw.sha,
        shortSha: raw.sha.slice(0, 7),
        parentShas: raw.parentShas,
        childShas: [],
        branchNames: dedupe(raw.refs),
        message: raw.message,
        timestamp: raw.timestamp,
        authorName: raw.authorName,
        authorEmail: raw.authorEmail,
        isMerge: raw.parentShas.length >= 2,
        laneIndex: 0,
        x: 0,
        y: 0,
      });
    }

    for (const node of nodes.values()) {
      for (const parentSha of node.parentShas) {
        const parent = nodes.get(parentSha);
        if (parent && !parent.childShas.includes(node.sha)) {
          parent.childShas.push(node.sha);
        }
      }
    }

    return {
      nodes,
      edges: [],
      orderedShas: this.topologicalSort(nodes),
      laneCount: 0,
      totalWidth: 0,
      totalHeight: 0,
    };
  }

  private topologicalSort(nodes: Map<string, CommitNode>): string[] {
    const remainingChildren = new Map<string, number>();
    for (const node of nodes.values()) {
      remainingChildren.set(
        node.sha,
        node.childShas.filter((childSha) => nodes.has(childSha)).length,
      );
    }

    const queue = Array.from(nodes.values())
      .filter((node) => (remainingChildren.get(node.sha) ?? 0) === 0)
      .sort((left, right) => right.timestamp - left.timestamp || left.sha.localeCompare(right.sha))
      .map((node) => node.sha);

    const ordered: string[] = [];

    while (queue.length > 0) {
      const sha = queue.shift();
      if (!sha) {
        break;
      }

      ordered.push(sha);
      const node = nodes.get(sha);
      if (!node) {
        continue;
      }

      for (const parentSha of node.parentShas) {
        if (!nodes.has(parentSha)) {
          continue;
        }

        const nextCount = (remainingChildren.get(parentSha) ?? 1) - 1;
        remainingChildren.set(parentSha, nextCount);
        if (nextCount === 0) {
          this.insertByTimestamp(queue, parentSha, nodes);
        }
      }
    }

    if (ordered.length < nodes.size) {
      const missing = Array.from(nodes.values())
        .filter((node) => !ordered.includes(node.sha))
        .sort((left, right) => right.timestamp - left.timestamp || left.sha.localeCompare(right.sha))
        .map((node) => node.sha);

      ordered.push(...missing);
    }

    return ordered;
  }

  private insertByTimestamp(queue: string[], sha: string, nodes: Map<string, CommitNode>): void {
    const candidate = nodes.get(sha);
    if (!candidate) {
      return;
    }

    const index = queue.findIndex((queuedSha) => {
      const queued = nodes.get(queuedSha);
      if (!queued) {
        return false;
      }

      if (queued.timestamp === candidate.timestamp) {
        return queued.sha.localeCompare(candidate.sha) > 0;
      }

      return queued.timestamp < candidate.timestamp;
    });

    if (index === -1) {
      queue.push(sha);
      return;
    }

    queue.splice(index, 0, sha);
  }
}
