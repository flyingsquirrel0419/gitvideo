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

export function buildCLI(): Command {
  const program = new Command();

  program
    .name('gitvideo')
    .description('GitHub 커밋 히스토리를 영상으로 변환')
    .version('1.0.0');

  const authCommand = program.command('auth').description('GitHub 로그인 관리');

  authCommand
    .command('login')
    .description('GitHub CLI 로그인 실행')
    .action(async () => {
      await runGitHubLogin();
    });

  authCommand
    .command('status')
    .description('GitHub CLI 로그인 상태 확인')
    .action(async () => {
      await runGitHubStatus();
    });

  program
    .command('generate')
    .description('영상 생성')
    .option('-r, --repo <path>', '로컬 git 레포 경로', process.cwd())
    .option('--github <owner/repo>', 'GitHub 레포 (예: torvalds/linux)')
    .option('--token <token>', 'GitHub API 토큰 (기본은 gh 로그인 사용)')
    .option('--config <file>', '설정 파일 경로')
    .option('-o, --output <file>', '출력 파일 경로', 'output.mp4')
    .option('--fps <number>', '프레임레이트', '30')
    .option('--speed <number>', '커밋당 프레임 수 (낮을수록 빠름)', '15')
    .option('--width <number>', '영상 너비', '1920')
    .option('--height <number>', '영상 높이', '1080')
    .option('--theme <name>', '테마 (dark|light)', 'dark')
    .option('--audio <file>', '배경음악 파일')
    .option('--max-commits <number>', '최대 커밋 수')
    .option('--exclude-branch <pattern>', '제외할 브랜치 glob 패턴', collectValues, [])
    .option('--keep-frames', '중간 프레임 PNG 보존')
    .action(async (options: CliGenerateOptions) => {
      const spinner = ora();
      let framesDir: string | null = null;

      try {
        const config = resolveAppConfig(options);
        const encoder = new FFmpegEncoder();

        if (!(await encoder.checkInstalled())) {
          throw new Error('FFmpeg is not installed. Install it first to encode mp4 output.');
        }

        spinner.start('커밋 히스토리 수집 중...');
        const rawCommits = await collectCommits(config);
        if (rawCommits.length === 0) {
          throw new Error('No commits found for the selected repository and filters.');
        }
        spinner.succeed(`커밋 ${rawCommits.length}개 수집 완료`);

        spinner.start('그래프 구성 중...');
        const dagBuilder = new DAGBuilder();
        let graph = dagBuilder.build(rawCommits);
        spinner.succeed('그래프 구성 완료');

        spinner.start('레이아웃 계산 중...');
        graph = new LayoutCalculator().calculate(graph, config.render.theme);
        spinner.succeed('레이아웃 계산 완료');

        framesDir = createTempDir('gitvideo');
        spinner.start('프레임 렌더링 중...');
        const animator = new Animator(graph, config.render);
        await animator.generateFrames(framesDir, (current, total) => {
          spinner.text = `프레임 렌더링 중... ${current}/${total} 커밋`;
        });
        spinner.succeed('프레임 렌더링 완료');

        spinner.start('영상 인코딩 중...');
        await encoder.encode({
          framesDir,
          outputPath: config.outputPath,
          fps: config.render.fps,
          audioPath: config.audioPath,
        });
        spinner.succeed(`영상 생성 완료: ${chalk.green(config.outputPath)}`);

        if (config.keepFrames) {
          console.log(chalk.yellow(`Frames kept at ${framesDir}`));
          framesDir = null;
        }
      } catch (error) {
        spinner.fail('오류 발생');
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
