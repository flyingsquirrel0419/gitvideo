import { describe, expect, it } from 'vitest';
import { GitParser } from '../../src/git/parser';

describe('GitParser', () => {
  const parser = new GitParser('.');

  it('parses a regular commit line', () => {
    const commit = parser.parseLine(
      'abcdef1234567890\x0011223344\x00HEAD -> main, origin/main\x00feat: add login\x001710000000\x00Alice\x00alice@example.com',
    );

    expect(commit.sha).toBe('abcdef1234567890');
    expect(commit.parentShas).toEqual(['11223344']);
    expect(commit.refs).toEqual(['main', 'origin/main']);
    expect(commit.message).toBe('feat: add login');
    expect(commit.timestamp).toBe(1710000000);
  });

  it('parses a merge commit line', () => {
    const commit = parser.parseLine(
      'merge123\x00parent1 parent2\x00origin/main, tag: v1.0.0\x00merge branch feature\x001710000100\x00Bob\x00bob@example.com',
    );

    expect(commit.parentShas).toEqual(['parent1', 'parent2']);
    expect(commit.refs).toEqual(['origin/main', 'tag/v1.0.0']);
  });
});
