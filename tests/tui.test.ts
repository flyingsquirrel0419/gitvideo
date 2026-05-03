import { describe, expect, it, vi } from 'vitest';
import { type CliGenerateOptions } from '../src/config';
import { promptForGenerateOptions, runTui } from '../src/tui';

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
