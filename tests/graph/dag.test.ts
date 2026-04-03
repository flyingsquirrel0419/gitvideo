import { describe, expect, it } from 'vitest';
import { DAGBuilder } from '../../src/graph/dag';
import { type RawCommit } from '../../src/git/types';

const rawCommits: RawCommit[] = [
  {
    sha: 'e',
    parentShas: ['d', 'c'],
    refs: ['main'],
    message: 'merge',
    timestamp: 5,
    authorName: 'A',
    authorEmail: 'a@example.com',
  },
  {
    sha: 'd',
    parentShas: ['b'],
    refs: [],
    message: 'main work',
    timestamp: 4,
    authorName: 'A',
    authorEmail: 'a@example.com',
  },
  {
    sha: 'c',
    parentShas: ['b'],
    refs: ['feature/login'],
    message: 'feature work',
    timestamp: 3,
    authorName: 'A',
    authorEmail: 'a@example.com',
  },
  {
    sha: 'b',
    parentShas: ['a'],
    refs: [],
    message: 'base',
    timestamp: 2,
    authorName: 'A',
    authorEmail: 'a@example.com',
  },
  {
    sha: 'a',
    parentShas: [],
    refs: [],
    message: 'root',
    timestamp: 1,
    authorName: 'A',
    authorEmail: 'a@example.com',
  },
];

describe('DAGBuilder', () => {
  it('builds child relationships', () => {
    const graph = new DAGBuilder().build(rawCommits);

    expect(graph.nodes.get('b')?.childShas.sort()).toEqual(['c', 'd']);
    expect(graph.nodes.get('d')?.childShas).toEqual(['e']);
  });

  it('orders commits from latest to oldest', () => {
    const graph = new DAGBuilder().build(rawCommits);
    expect(graph.orderedShas).toEqual(['e', 'd', 'c', 'b', 'a']);
  });

  it('marks merge commits', () => {
    const graph = new DAGBuilder().build(rawCommits);
    expect(graph.nodes.get('e')?.isMerge).toBe(true);
    expect(graph.nodes.get('d')?.isMerge).toBe(false);
  });
});
