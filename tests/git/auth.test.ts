import { describe, expect, it } from 'vitest';
import { parseGhStatusToken } from '../../src/git/auth';

describe('parseGhStatusToken', () => {
  it('extracts a token from gh auth status --show-token output', () => {
    const output = [
      'github.com',
      '  ✓ Logged in to github.com as flyingsquirrel0419 (/root/.config/gh/hosts.yml)',
      '  ✓ Git operations for github.com configured to use https protocol.',
      '  ✓ Token: gho_exampleToken123',
      '',
    ].join('\n');

    expect(parseGhStatusToken(output)).toBe('gho_exampleToken123');
  });

  it('returns undefined when the token line is absent', () => {
    const output = [
      'github.com',
      '  ✓ Logged in to github.com as flyingsquirrel0419 (/root/.config/gh/hosts.yml)',
    ].join('\n');

    expect(parseGhStatusToken(output)).toBeUndefined();
  });
});
