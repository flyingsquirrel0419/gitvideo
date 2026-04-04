import * as fs from 'node:fs';
import { Command } from 'commander';
import chalk from 'chalk';
import ora from 'ora';
import { resolveAppConfig, type CliGenerateOptions } from './config';
import { FFmpegEncoder } from './encoder/ffmpeg';
import { resolveGitHubToken, runGitHubLogin, runGitHubStatus } from './git/auth';
import { GitHubApiParser } from './git/githubApi';
import { GitParser } from './git/parser';
import { DAGBuilder } from './graph/dag';
import { LayoutCalculator } from './graph/layout';
import { Animator } from './renderer/animator';
import { createTempDir, removeDir } from './utils/fileUtils';

function collectValues(value: string, previous: string[]): string[] {
  return [...previous, value];
}

function toPercent(current: number, total: number): number {
  if (total <= 0) {
    return 0;
  }
  return Math.min(100, Math.round((current / total) * 100));
}

export function buildCLI(): Command {
  const program = new Command();

  program
    .name('gitvideo')
    .description('Turn Git commit history into an animated video')
    .version('1.0.0');

  const authCommand = program.command('auth').description('Manage GitHub authentication');

  authCommand
    .command('login')
    .description('Start GitHub CLI login')
    .action(async () => {
      await runGitHubLogin();
    });

  authCommand
    .command('status')
    .description('Show GitHub CLI auth status')
    .action(async () => {
      await runGitHubStatus();
    });

  program
    .command('generate')
    .description('Generate a video')
    .option('-r, --repo <path>', 'Path to a local git repository', process.cwd())
    .option('--github <owner/repo>', 'GitHub repository, for example torvalds/linux')
    .option('--token <token>', 'GitHub API token override; defaults to gh auth token')
    .option('--config <file>', 'Path to a config file')
    .option('-o, --output <file>', 'Output video file path')
    .option('--output-dir <dir>', 'Output directory for the generated video')
    .option('--fps <number>', 'Frame rate', '30')
    .option('--speed <number>', 'Frames per commit; lower is faster', '15')
    .option('--width <number>', 'Video width', '1920')
    .option('--height <number>', 'Video height', '1080')
    .option('--theme <name>', 'Theme (dark|light)', 'dark')
    .option('--audio <file>', 'Background audio file')
    .option('--max-commits <number>', 'Maximum number of commits to include')
    .option('--exclude-branch <pattern>', 'Branch glob pattern to exclude', collectValues, [])
    .option('--keep-frames', 'Keep intermediate PNG frames')
    .action(async (options: CliGenerateOptions) => {
      const spinner = ora();
      let framesDir: string | null = null;

      try {
        const config = resolveAppConfig(options);
        const encoder = new FFmpegEncoder();

        if (!(await encoder.checkInstalled())) {
          throw new Error('FFmpeg is not installed. Install it first to encode mp4 output.');
        }

        spinner.start('Collecting commit history...');
        const rawCommits = await collectCommits(config);
        if (rawCommits.length === 0) {
          throw new Error('No commits found for the selected repository and filters.');
        }
        spinner.succeed(`Collected ${rawCommits.length} commits`);

        spinner.start('Building graph...');
        const dagBuilder = new DAGBuilder();
        let graph = dagBuilder.build(rawCommits);
        spinner.succeed('Graph built');

        spinner.start('Calculating layout...');
        graph = new LayoutCalculator().calculate(graph, config.render.theme);
        spinner.succeed('Layout ready');

        framesDir = createTempDir('gitvideo');
        spinner.start('Rendering frames...');
        const animator = new Animator(graph, config.render);
        await animator.generateFrames(framesDir, (current, total) => {
          spinner.text = `Rendering frames... ${toPercent(current, total)}% (${current}/${total} commits)`;
        });
        spinner.succeed('Frames rendered');

        spinner.start('Encoding video...');
        await encoder.encode({
          framesDir,
          outputPath: config.outputPath,
          fps: config.render.fps,
          audioPath: config.audioPath,
        });
        spinner.succeed(`Video created: ${chalk.green(config.outputPath)}`);

        if (config.keepFrames) {
          console.log(chalk.yellow(`Frames kept at ${framesDir}`));
          framesDir = null;
        }
      } catch (error) {
        spinner.fail('Command failed');
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exitCode = 1;
      } finally {
        if (framesDir && fs.existsSync(framesDir)) {
          removeDir(framesDir);
        }
      }
    });

  return program;
}

async function collectCommits(config: ReturnType<typeof resolveAppConfig>) {
  if (config.github) {
    const [owner, repo] = config.github.split('/');
    if (!owner || !repo) {
      throw new Error('--github must be in the form owner/repo.');
    }
    const token = await resolveGitHubToken(config.token);

    return new GitHubApiParser(token).parseAll(owner, repo, {
      maxCommits: config.maxCommits,
      excludeBranches: config.excludeBranches,
    });
  }

  return new GitParser(config.repoPath).parseAll({
    maxCommits: config.maxCommits,
    excludeBranches: config.excludeBranches,
  });
}
