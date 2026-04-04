import * as fs from 'node:fs';
import * as path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { Animator } from '../../src/renderer/animator';
import { DARK_THEME } from '../../src/renderer/theme';
import { removeDir } from '../../src/utils/fileUtils';
import { DAGBuilder } from '../../src/graph/dag';
import { LayoutCalculator } from '../../src/graph/layout';
import { type RawCommit } from '../../src/git/types';

const outputDir = path.join(process.cwd(), 'tmp-test-frames');

afterEach(() => {
  removeDir(outputDir);
});

describe('Animator', () => {
  it('writes png frames for the animation sequence', async () => {
    const commits: RawCommit[] = [
      {
        sha: 'b',
        parentShas: ['a'],
        refs: ['main'],
        message: 'second',
        timestamp: 2,
        authorName: 'A',
        authorEmail: 'a@example.com',
      },
      {
        sha: 'a',
        parentShas: [],
        refs: [],
        message: 'first',
        timestamp: 1,
        authorName: 'A',
        authorEmail: 'a@example.com',
      },
    ];

    const graph = new LayoutCalculator().calculate(new DAGBuilder().build(commits), DARK_THEME);
    const animator = new Animator(graph, {
      width: 800,
      height: 600,
      fps: 2,
      framesPerCommit: 2,
      renderWorkers: 1,
      theme: DARK_THEME,
    });

    const progressEvents: Array<{ current: number; total: number }> = [];

    await animator.generateFrames(outputDir, (current, total) => {
      progressEvents.push({ current, total });
    });
    const generated = fs.readdirSync(outputDir).filter((file) => file.endsWith('.png'));
    expect(generated.length).toBe(6);
    expect(progressEvents.at(-1)).toEqual({ current: 6, total: 6 });
  });
});
