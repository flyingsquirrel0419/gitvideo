import * as readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import { type CliGenerateOptions } from './config';

export type Ask = (question: string) => Promise<string>;
export type Write = (message: string) => void;
export type Generate = (options: CliGenerateOptions) => Promise<void>;

export interface TuiDependencies {
  ask?: Ask;
  write?: Write;
  generate: Generate;
}

function clean(value: string): string | undefined {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function yes(value: string | undefined): boolean {
  return value?.toLowerCase() === 'y' || value?.toLowerCase() === 'yes';
}

function assignIfPresent(
  options: CliGenerateOptions,
  key: keyof CliGenerateOptions,
  value: string | undefined,
): void {
  if (value !== undefined) {
    (options[key] as string | boolean | string[] | undefined) = value;
  }
}

export async function promptForGenerateOptions(ask: Ask): Promise<CliGenerateOptions> {
  const options: CliGenerateOptions = {};
  const source = clean(await ask('Repository source (local/github) [local]: ')) ?? 'local';

  if (source.toLowerCase() === 'github') {
    const github = clean(await ask('GitHub repository (owner/repo): '));
    if (!github) {
      throw new Error('GitHub repository is required when source is github.');
    }
    options.github = github;
  } else {
    options.repo = clean(await ask('Local repository path [.]: ')) ?? '.';
  }

  assignIfPresent(options, 'outputDir', clean(await ask('Output directory [current directory]: ')));
  assignIfPresent(options, 'theme', clean(await ask('Theme (dark/light) [dark]: ')));
  assignIfPresent(options, 'speed', clean(await ask('Frames per commit speed [15]: ')));
  assignIfPresent(options, 'maxCommits', clean(await ask('Maximum commits [all]: ')));
  assignIfPresent(options, 'renderWorkers', clean(await ask('Render workers [1]: ')));

  if (yes(clean(await ask('Keep rendered frames? (y/N): ')))) {
    options.keepFrames = true;
  }

  return options;
}

export async function runTui(dependencies: TuiDependencies): Promise<void> {
  const write = dependencies.write ?? ((message) => output.write(message));
  const fallbackInterface = dependencies.ask
    ? undefined
    : readline.createInterface({ input, output });
  const ask = dependencies.ask ?? ((question) => fallbackInterface!.question(question));

  try {
    write(`${chalk.bold('gitvideo TUI')}\n`);
    write('Press Enter to accept defaults.\n\n');
    const options = await promptForGenerateOptions(ask);
    await dependencies.generate(options);
  } finally {
    fallbackInterface?.close();
  }
}
