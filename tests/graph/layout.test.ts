import { describe, expect, it } from 'vitest';
import { DAGBuilder } from '../../src/graph/dag';
import { LayoutCalculator } from '../../src/graph/layout';
import { type RawCommit } from '../../src/git/types';
import { DARK_THEME } from '../../src/renderer/theme';

describe('LayoutCalculator', () => {
  it('keeps a linear history on lane 0', () => {
    const commits: RawCommit[] = [
      {
        sha: 'c',
        parentShas: ['b'],
        refs: ['main'],
        message: 'c',
        timestamp: 3,
        authorName: 'A',
        authorEmail: 'a@example.com',
      },
      {
        sha: 'b',
        parentShas: ['a'],
        refs: [],
        message: 'b',
        timestamp: 2,
        authorName: 'A',
        authorEmail: 'a@example.com',
      },
      {
        sha: 'a',
        parentShas: [],
        refs: [],
        message: 'a',
        timestamp: 1,
        authorName: 'A',
        authorEmail: 'a@example.com',
      },
    ];

    const graph = new LayoutCalculator().calculate(new DAGBuilder().build(commits), DARK_THEME);
    expect(Array.from(graph.nodes.values()).every((node) => node.laneIndex === 0)).toBe(true);
    expect(graph.laneCount).toBe(1);
  });

  it('creates an extra lane for a branch and merge', () => {
    const commits: RawCommit[] = [
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

    const graph = new LayoutCalculator().calculate(new DAGBuilder().build(commits), DARK_THEME);
    expect(graph.laneCount).toBe(2);
    expect(graph.nodes.get('d')?.laneIndex).toBe(0);
    expect(graph.nodes.get('c')?.laneIndex).toBe(1);
    expect(graph.edges).toHaveLength(5);
  });
});
