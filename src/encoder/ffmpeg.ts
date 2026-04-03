import { spawn } from 'node:child_process';
import * as path from 'node:path';

export interface EncodeOptions {
  framesDir: string;
  outputPath: string;
  fps: number;
  audioPath?: string;
  crf?: number;
}

export class FFmpegEncoder {
  async encode(options: EncodeOptions): Promise<void> {
    const { framesDir, outputPath, fps, audioPath, crf = 18 } = options;
    const args = ['-y', '-framerate', String(fps), '-i', path.join(framesDir, 'frame_%06d.png')];

    if (audioPath) {
      args.push('-i', audioPath, '-shortest');
    }

    args.push(
      '-c:v',
      'libx264',
      '-preset',
      'slow',
      '-crf',
      String(crf),
      '-pix_fmt',
      'yuv420p',
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      outputPath,
    );

    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', args);
      let stderr = '';

      child.stderr.on('data', (chunk) => {
        stderr += chunk.toString();
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          resolve();
          return;
        }
        reject(new Error(`FFmpeg exited with code ${code}: ${stderr.trim()}`));
      });
    });
  }

  async checkInstalled(): Promise<boolean> {
    return new Promise((resolve) => {
      const child = spawn('ffmpeg', ['-version']);
      child.on('error', () => resolve(false));
      child.on('close', (code) => resolve(code === 0));
    });
  }
}
