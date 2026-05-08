import { emitKeypressEvents, type Key } from 'node:readline';
import * as readlinePromises from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';
import chalk from 'chalk';
import { type CliGenerateOptions } from './config';

export type Ask = (question: string) => Promise<string>;
export type Write = (message: string) => void;
export type Generate = (options: CliGenerateOptions) => Promise<void>;
export type TuiCommand = () => Promise<void>;

export interface TuiDependencies {
  ask?: Ask;
  write?: Write;
  generate: Generate;
  login?: TuiCommand;
  status?: TuiCommand;
  input?: NodeJS.ReadStream;
  output?: NodeJS.WriteStream;
}

export interface MenuItem {
  id: 'quick' | 'local' | 'github' | 'login' | 'status' | 'exit';
  label: string;
  description: string;
  hotkey: string;
}

export const mainMenuItems: MenuItem[] = [
  {
    id: 'quick',
    label: 'Quick render current directory',
    description: 'Use this folder with default video settings.',
    hotkey: '1',
  },
  {
    id: 'local',
    label: 'Configure local repository',
    description: 'Pick a repo path, output folder, theme, speed, and limits.',
    hotkey: '2',
  },
  {
    id: 'github',
    label: 'Configure GitHub repository',
    description: 'Render owner/repo through the GitHub API.',
    hotkey: '3',
  },
  {
    id: 'login',
    label: 'GitHub login',
    description: 'Open gh auth login for GitHub rendering.',
    hotkey: '4',
  },
  {
    id: 'status',
    label: 'GitHub auth status',
    description: 'Check the current gh authentication state.',
    hotkey: '5',
  },
  {
    id: 'exit',
    label: 'Exit',
    description: 'Close gitvideo without running anything.',
    hotkey: 'q',
  },
];

const ansi = {
  reset: '\x1b[0m',
  clear: '\x1b[2J\x1b[H',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  inverse: '\x1b[7m',
  magenta: '\x1b[35m',
  white: '\x1b[37m',
  yellow: '\x1b[33m',
};
const ansiStylePattern = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*m`, 'g');

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

function visibleLength(value: string): number {
  return value.replace(ansiStylePattern, '').length;
}

function fit(value: string, width: number): string {
  const plain = value.replace(ansiStylePattern, '');
  if (plain.length <= width) {
    return plain.padEnd(width, ' ');
  }
  if (width <= 1) {
    return plain.slice(0, width);
  }
  return `${plain.slice(0, width - 1)}…`;
}

function color(value: string, code: string): string {
  return `${code}${value}${ansi.reset}`;
}

function paintFit(value: string, width: number, code: string): string {
  return color(fit(value, width), code);
}

function padVisible(value: string, width: number): string {
  const visible = visibleLength(value);
  if (visible > width) {
    return fit(value, width);
  }
  return `${value}${' '.repeat(width - visible)}`;
}

function framedLine(content: string, width: number): string {
  const innerWidth = Math.max(0, width - 4);
  return `${ansi.dim}│${ansi.reset} ${padVisible(content, innerWidth)} ${ansi.dim}│${ansi.reset}`;
}

function divider(width: number): string {
  return color(`├${'─'.repeat(width - 2)}┤`, ansi.dim);
}

function sectionTitle(label: string, width: number): string {
  const innerWidth = Math.max(0, width - 4);
  return framedLine(paintFit(label.toUpperCase(), innerWidth, ansi.yellow), width);
}

function statusText(item: MenuItem): string {
  if (item.id === 'quick') {
    return 'ready';
  }
  if (item.id === 'login' || item.id === 'status') {
    return 'github';
  }
  if (item.id === 'exit') {
    return 'close';
  }
  return 'setup';
}

function renderMenuRow(item: MenuItem, selected: boolean, innerWidth: number): string {
  const marker = selected ? color('▶', ansi.green) : color(' ', ansi.dim);
  const hotkey = selected ? color(`[${item.hotkey}]`, ansi.inverse) : color(`[${item.hotkey}]`, ansi.cyan);
  const status = selected ? color(statusText(item), ansi.green) : color(statusText(item), ansi.dim);
  const fixedWidth = visibleLength(`${marker} ${hotkey}  `) + visibleLength(`  ${status}`);
  const labelWidth = Math.max(8, innerWidth - fixedWidth);
  return `${marker} ${hotkey}  ${paintFit(item.label, labelWidth, selected ? ansi.white : ansi.reset)}  ${status}`;
}

function renderProgressRail(width: number): string {
  const innerWidth = Math.max(0, width - 4);
  const label = 'repo → graph → frames → mp4';
  if (innerWidth < label.length + 4) {
    return framedLine(paintFit(label, innerWidth, ansi.dim), width);
  }
  const railWidth = Math.max(0, innerWidth - label.length - 2);
  const rail = `${color('●', ansi.green)}${color('─'.repeat(Math.max(0, railWidth - 2)), ansi.dim)}${color('●', ansi.magenta)}`;
  return framedLine(`${label} ${rail}`, width);
}

export interface RenderAppFrameOptions {
  selectedIndex: number;
  columns: number;
  rows: number;
  status?: string;
}

export function renderAppFrame(options: RenderAppFrameOptions): string {
  const width = Math.max(28, Math.min(options.columns, 96));
  const height = Math.max(7, options.rows);
  const innerWidth = width - 4;
  const selected = mainMenuItems[options.selectedIndex] ?? mainMenuItems[0];
  const compact = height < 12;
  const lines: string[] = [ansi.clear];

  lines.push(color(`┌${'─'.repeat(width - 2)}┐`, ansi.dim));
  lines.push(framedLine(`${color('gitvideo', ansi.cyan)} ${color('studio', ansi.magenta)} ${paintFit('commit history to motion', Math.max(0, innerWidth - 16), ansi.dim)}`, width));
  lines.push(renderProgressRail(width));
  lines.push(divider(width));

  if (compact) {
    lines.push(framedLine(`${color(`${options.selectedIndex + 1}/${mainMenuItems.length}`, ansi.green)} ${paintFit(selected.label, innerWidth - 5, ansi.inverse)}`, width));
    if (height >= 8) {
      lines.push(framedLine(paintFit(selected.description, innerWidth, ansi.dim), width));
    }
    lines.push(framedLine(paintFit('↑/↓ move  Enter run  q quit', innerWidth, ansi.dim), width));
  } else {
    lines.push(sectionTitle('Actions', width));
    const maxMenuRows = Math.max(1, Math.min(mainMenuItems.length, height - 12));
    for (const [index, item] of mainMenuItems.slice(0, maxMenuRows).entries()) {
      lines.push(framedLine(renderMenuRow(item, index === options.selectedIndex, innerWidth), width));
    }
    lines.push(divider(width));
    lines.push(sectionTitle('Selected', width));
    lines.push(framedLine(`${paintFit(selected.label, Math.max(0, innerWidth - 11), ansi.white)} ${paintFit(statusText(selected), 9, ansi.green)}`, width));
    lines.push(framedLine(paintFit(selected.description, innerWidth, ansi.dim), width));
    lines.push(framedLine(paintFit('↑/↓ move  Enter run  1-5/q shortcut  Esc quit', innerWidth, ansi.dim), width));
  }

  if (options.status) {
    lines.push(framedLine(paintFit(options.status, innerWidth, ansi.yellow), width));
  }

  while (lines.length < height - 1) {
    lines.push(framedLine('', width));
  }
  lines.push(color(`└${'─'.repeat(width - 2)}┘`, ansi.dim));
  return lines.slice(0, height).join('\n');
}

export interface MenuKeyResult {
  selectedIndex: number;
  action?: 'select' | 'exit';
}

export function handleMenuKey(selectedIndex: number, key: Pick<Key, 'name'>, itemCount: number): MenuKeyResult {
  if (key.name === 'up') {
    return { selectedIndex: (selectedIndex - 1 + itemCount) % itemCount };
  }
  if (key.name === 'down') {
    return { selectedIndex: (selectedIndex + 1) % itemCount };
  }
  if (key.name === 'return' || key.name === 'enter') {
    return { selectedIndex, action: 'select' };
  }
  if (key.name === 'q' || key.name === 'escape') {
    return { selectedIndex, action: 'exit' };
  }
  return { selectedIndex };
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

async function promptForLocalOptions(ask: Ask): Promise<CliGenerateOptions> {
  const options: CliGenerateOptions = {
    repo: clean(await ask('Local repository path [.]: ')) ?? '.',
  };
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

async function promptForGitHubOptions(ask: Ask): Promise<CliGenerateOptions> {
  const github = clean(await ask('GitHub repository (owner/repo): '));
  if (!github) {
    throw new Error('GitHub repository is required.');
  }
  const options: CliGenerateOptions = { github };
  assignIfPresent(options, 'outputDir', clean(await ask('Output directory [current directory]: ')));
  assignIfPresent(options, 'theme', clean(await ask('Theme (dark/light) [dark]: ')));
  assignIfPresent(options, 'speed', clean(await ask('Frames per commit speed [15]: ')));
  assignIfPresent(options, 'maxCommits', clean(await ask('Maximum commits [all]: ')));
  assignIfPresent(options, 'renderWorkers', clean(await ask('Render workers [1]: ')));
  return options;
}

function isInteractive(dependencies: TuiDependencies): boolean {
  const readStream = dependencies.input ?? input;
  const writeStream = dependencies.output ?? output;
  return !dependencies.ask && Boolean(readStream.isTTY && writeStream.isTTY);
}

function chooseFromMenu(dependencies: TuiDependencies): Promise<MenuItem> {
  const readStream = dependencies.input ?? input;
  const writeStream = dependencies.output ?? output;
  let selectedIndex = 0;

  return new Promise((resolve) => {
    const render = (status?: string) => {
      writeStream.write(renderAppFrame({
        selectedIndex,
        columns: writeStream.columns ?? 80,
        rows: writeStream.rows ?? 24,
        status,
      }));
    };

    const cleanup = () => {
      readStream.off('keypress', onKeypress);
      writeStream.off('resize', onResize);
      readStream.setRawMode?.(false);
      readStream.pause();
      writeStream.write('\n');
    };

    const finish = (item: MenuItem) => {
      cleanup();
      resolve(item);
    };

    const onResize = () => render();
    const onKeypress = (_value: string, key: Key) => {
      const hotkeyIndex = mainMenuItems.findIndex((item) => item.hotkey === key.name);
      if (hotkeyIndex >= 0) {
        selectedIndex = hotkeyIndex;
        finish(mainMenuItems[selectedIndex]);
        return;
      }

      const result = handleMenuKey(selectedIndex, key, mainMenuItems.length);
      selectedIndex = result.selectedIndex;
      if (result.action === 'exit') {
        finish(mainMenuItems[mainMenuItems.length - 1]);
        return;
      }
      if (result.action === 'select') {
        finish(mainMenuItems[selectedIndex]);
        return;
      }
      render();
    };

    emitKeypressEvents(readStream);
    readStream.setRawMode?.(true);
    readStream.resume();
    readStream.on('keypress', onKeypress);
    writeStream.on('resize', onResize);
    render();
  });
}

async function runPromptTui(dependencies: TuiDependencies): Promise<void> {
  const appOutput = dependencies.output ?? output;
  const write = dependencies.write ?? ((message) => appOutput.write(message));
  const fallbackInterface = dependencies.ask
    ? undefined
    : readlinePromises.createInterface({ input: dependencies.input ?? input, output: appOutput });
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

async function runInteractiveTui(dependencies: TuiDependencies): Promise<void> {
  const appOutput = dependencies.output ?? output;
  const item = await chooseFromMenu(dependencies);
  const promptInterface = readlinePromises.createInterface({
    input: dependencies.input ?? input,
    output: appOutput,
  });
  const ask: Ask = (question) => promptInterface.question(question);

  try {
    if (item.id === 'exit') {
      return;
    }
    if (item.id === 'quick') {
      await dependencies.generate({ repo: '.' });
      return;
    }
    if (item.id === 'local') {
      await dependencies.generate(await promptForLocalOptions(ask));
      return;
    }
    if (item.id === 'github') {
      await dependencies.generate(await promptForGitHubOptions(ask));
      return;
    }
    if (item.id === 'login') {
      await dependencies.login?.();
      return;
    }
    if (item.id === 'status') {
      await dependencies.status?.();
    }
  } finally {
    promptInterface.close();
  }
}

export async function runTui(dependencies: TuiDependencies): Promise<void> {
  if (isInteractive(dependencies)) {
    await runInteractiveTui(dependencies);
    return;
  }
  await runPromptTui(dependencies);
}
