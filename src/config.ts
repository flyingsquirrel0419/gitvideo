import * as fs from 'node:fs';
import * as path from 'node:path';
import { z } from 'zod';
import { DARK_THEME, LIGHT_THEME } from './renderer/theme';
import { type RenderConfig, type Theme } from './renderer/types';

export const fileConfigSchema = z.object({
  fps: z.number().int().positive().optional(),
  framesPerCommit: z.number().int().positive().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  renderWorkers: z.number().int().positive().optional(),
  theme: z.enum(['dark', 'light']).optional(),
  output: z.string().min(1).optional(),
  maxCommits: z.number().int().positive().optional(),
  excludeBranches: z.array(z.string().min(1)).optional(),
});

export interface CliGenerateOptions {
  repo?: string;
  github?: string;
  token?: string;
  output?: string;
  outputDir?: string;
  fps?: string;
  speed?: string;
  renderWorkers?: string;
  width?: string;
  height?: string;
  theme?: string;
  audio?: string;
  keepFrames?: boolean;
  config?: string;
  maxCommits?: string;
  excludeBranch?: string[];
}

export interface AppConfig {
  repoPath: string;
  github?: string;
  token?: string;
  outputPath: string;
  audioPath?: string;
  keepFrames: boolean;
  maxCommits?: number;
  excludeBranches: string[];
  render: RenderConfig;
  themeName: 'dark' | 'light';
}

function sanitizeFileSegment(value: string): string {
  return value
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

function detectCurrentBranch(repoPath: string): string | undefined {
  try {
    const headPath = path.join(repoPath, '.git', 'HEAD');
    if (!fs.existsSync(headPath)) {
      return undefined;
    }

    const head = fs.readFileSync(headPath, 'utf8').trim();
    const refPrefix = 'ref: refs/heads/';
    if (!head.startsWith(refPrefix)) {
      return undefined;
    }

    return head.slice(refPrefix.length);
  } catch {
    return undefined;
  }
}

function buildDefaultOutputName(repoPath: string, github?: string): string {
  if (github) {
    const [owner = 'repo', repo = 'history'] = github.split('/');
    return `${sanitizeFileSegment(owner)}-${sanitizeFileSegment(repo)}.mp4`;
  }

  const repoName = sanitizeFileSegment(path.basename(repoPath) || 'repository');
  const branchName = sanitizeFileSegment(detectCurrentBranch(repoPath) ?? 'history');
  return `${repoName}-${branchName}.mp4`;
}

function parsePositiveInt(value: string | undefined, label: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return parsed;
}

function parseTheme(themeName: string | undefined): 'dark' | 'light' | undefined {
  if (themeName === undefined) {
    return undefined;
  }
  if (themeName !== 'dark' && themeName !== 'light') {
    throw new Error('theme must be either "dark" or "light".');
  }
  return themeName;
}

function resolveTheme(themeName: 'dark' | 'light'): Theme {
  return themeName === 'light' ? LIGHT_THEME : DARK_THEME;
}

export function loadConfigFile(configPath?: string): z.infer<typeof fileConfigSchema> {
  if (configPath) {
    const resolvedPath = path.resolve(configPath);
    if (!fs.existsSync(resolvedPath)) {
      return {};
    }
    const parsed = JSON.parse(fs.readFileSync(resolvedPath, 'utf8')) as unknown;
    return fileConfigSchema.parse(parsed);
  }

  const defaultPaths = [
    path.resolve('gitvideo.config.json'),
    path.resolve('git-viz.config.json'),
  ];
  const existingPath = defaultPaths.find((candidate) => fs.existsSync(candidate));
  if (!existingPath) {
    return {};
  }

  const parsed = JSON.parse(fs.readFileSync(existingPath, 'utf8')) as unknown;
  return fileConfigSchema.parse(parsed);
}

export function resolveAppConfig(cliOptions: CliGenerateOptions): AppConfig {
  const fileConfig = loadConfigFile(cliOptions.config);
  const themeName = parseTheme(cliOptions.theme) ?? fileConfig.theme ?? 'dark';
  const repoPath = path.resolve(cliOptions.repo ?? process.cwd());

  const width = parsePositiveInt(cliOptions.width, 'width') ?? fileConfig.width ?? 1920;
  const height = parsePositiveInt(cliOptions.height, 'height') ?? fileConfig.height ?? 1080;
  const fps = parsePositiveInt(cliOptions.fps, 'fps') ?? fileConfig.fps ?? 30;
  const framesPerCommit = parsePositiveInt(cliOptions.speed, 'speed') ?? fileConfig.framesPerCommit ?? 15;
  const renderWorkers = parsePositiveInt(cliOptions.renderWorkers, 'renderWorkers')
    ?? fileConfig.renderWorkers
    ?? 1;
  const maxCommits = parsePositiveInt(cliOptions.maxCommits, 'maxCommits') ?? fileConfig.maxCommits;
  const excludeBranches = cliOptions.excludeBranch?.length
    ? cliOptions.excludeBranch
    : fileConfig.excludeBranches ?? [];
  const requestedOutput = cliOptions.output ?? fileConfig.output;
  const defaultFileName = buildDefaultOutputName(repoPath, cliOptions.github);
  const outputPath = cliOptions.outputDir
    ? path.resolve(cliOptions.outputDir, requestedOutput ?? defaultFileName)
    : path.resolve(requestedOutput ?? defaultFileName);

  return {
    repoPath,
    github: cliOptions.github,
    token: cliOptions.token ?? process.env.GITHUB_TOKEN,
    outputPath,
    audioPath: cliOptions.audio ? path.resolve(cliOptions.audio) : undefined,
    keepFrames: Boolean(cliOptions.keepFrames),
    maxCommits,
    excludeBranches,
    themeName,
    render: {
      width,
      height,
      fps,
      framesPerCommit,
      renderWorkers,
      theme: resolveTheme(themeName),
    },
  };
}
