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
  fps?: string;
  speed?: string;
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

  const width = parsePositiveInt(cliOptions.width, 'width') ?? fileConfig.width ?? 1920;
  const height = parsePositiveInt(cliOptions.height, 'height') ?? fileConfig.height ?? 1080;
  const fps = parsePositiveInt(cliOptions.fps, 'fps') ?? fileConfig.fps ?? 30;
  const framesPerCommit = parsePositiveInt(cliOptions.speed, 'speed') ?? fileConfig.framesPerCommit ?? 15;
  const maxCommits = parsePositiveInt(cliOptions.maxCommits, 'maxCommits') ?? fileConfig.maxCommits;
  const excludeBranches = cliOptions.excludeBranch?.length
    ? cliOptions.excludeBranch
    : fileConfig.excludeBranches ?? [];

  return {
    repoPath: path.resolve(cliOptions.repo ?? process.cwd()),
    github: cliOptions.github,
    token: cliOptions.token ?? process.env.GITHUB_TOKEN,
    outputPath: path.resolve(cliOptions.output ?? fileConfig.output ?? 'output.mp4'),
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
      theme: resolveTheme(themeName),
    },
  };
}
