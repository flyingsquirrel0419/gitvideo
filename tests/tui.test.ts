import { describe, expect, it, vi } from 'vitest';
import { type CliGenerateOptions } from '../src/config';
import {
  handleMenuKey,
  mainMenuItems,
  promptForGenerateOptions,
  renderAppFrame,
  runTui,
} from '../src/tui';

const ansiPattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

describe('renderAppFrame', () => {
  it('renders a colored app-like frame that fits the terminal width', () => {
    const frame = renderAppFrame({
      selectedIndex: 0,
      columns: 42,
      rows: 12,
    });

    expect(frame).toContain('\x1b[');
    expect(frame).toContain('gitvideo');
    expect(frame).toContain('Quick render');
    for (const line of frame.split('\n')) {
      expect(line.replace(ansiPattern, '').length).toBeLessThanOrEqual(42);
    }
  });

  it('uses a compact layout for short terminals', () => {
    const frame = renderAppFrame({
      selectedIndex: 1,
      columns: 32,
      rows: 7,
    });

    expect(frame).toContain('2/6');
    expect(frame).toContain('Use arrows');
    for (const line of frame.split('\n')) {
      expect(line.replace(ansiPattern, '').length).toBeLessThanOrEqual(32);
    }
  });
});

describe('handleMenuKey', () => {
  it('moves selection with arrow keys and wraps around', () => {
    expect(handleMenuKey(0, { name: 'down' }, mainMenuItems.length).selectedIndex).toBe(1);
    expect(handleMenuKey(0, { name: 'up' }, mainMenuItems.length).selectedIndex).toBe(mainMenuItems.length - 1);
  });

  it('selects with enter and exits with q', () => {
    expect(handleMenuKey(2, { name: 'return' }, mainMenuItems.length)).toEqual({
      selectedIndex: 2,
      action: 'select',
    });
    expect(handleMenuKey(2, { name: 'q' }, mainMenuItems.length)).toEqual({
      selectedIndex: 2,
      action: 'exit',
    });
  });
});

describe('promptForGenerateOptions', () => {
  it('collects local repository settings with defaults', async () => {
    const answers = new Map<string, string>([
      ['Repository source (local/github) [local]: ', ''],
      ['Local repository path [.]: ', './project'],
      ['Output directory [current directory]: ', '~/Videos'],
      ['Theme (dark/light) [dark]: ', 'light'],
      ['Frames per commit speed [15]: ', '8'],
      ['Maximum commits [all]: ', '50'],
      ['Render workers [1]: ', '4'],
      ['Keep rendered frames? (y/N): ', 'y'],
    ]);

    const options = await promptForGenerateOptions((question) => Promise.resolve(answers.get(question) ?? ''));

    expect(options).toEqual({
      repo: './project',
      outputDir: '~/Videos',
      theme: 'light',
      speed: '8',
      maxCommits: '50',
      renderWorkers: '4',
      keepFrames: true,
    });
  });

  it('collects GitHub repository settings and skips local repo', async () => {
    const answers = new Map<string, string>([
      ['Repository source (local/github) [local]: ', 'github'],
      ['GitHub repository (owner/repo): ', 'flyingsquirrel0419/gitvideo'],
      ['Output directory [current directory]: ', ''],
      ['Theme (dark/light) [dark]: ', ''],
      ['Frames per commit speed [15]: ', ''],
      ['Maximum commits [all]: ', ''],
      ['Render workers [1]: ', ''],
      ['Keep rendered frames? (y/N): ', ''],
    ]);

    const options = await promptForGenerateOptions((question) => Promise.resolve(answers.get(question) ?? ''));

    expect(options).toEqual({
      github: 'flyingsquirrel0419/gitvideo',
    });
  });
});

describe('runTui', () => {
  it('prints a TUI heading and runs generation with collected options', async () => {
    const generate = vi.fn<[CliGenerateOptions], Promise<void>>()
      .mockResolvedValue(undefined);
    const write = vi.fn();

    await runTui({
      ask: async (question) => {
        const answers: Record<string, string> = {
          'Repository source (local/github) [local]: ': '',
          'Local repository path [.]: ': '.',
          'Output directory [current directory]: ': '',
          'Theme (dark/light) [dark]: ': '',
          'Frames per commit speed [15]: ': '',
          'Maximum commits [all]: ': '',
          'Render workers [1]: ': '',
          'Keep rendered frames? (y/N): ': '',
        };
        return answers[question] ?? '';
      },
      write,
      generate,
    });

    expect(write).toHaveBeenCalledWith(expect.stringContaining('gitvideo TUI'));
    expect(generate).toHaveBeenCalledWith({ repo: '.' });
  });
});
