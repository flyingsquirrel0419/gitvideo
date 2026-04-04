import { spawn } from 'node:child_process';
import * as path from 'node:path';

export interface EncodeOptions {
  framesDir: string;
  outputPath: string;
  fps: number;
  audioPath?: string;
  crf?: number;
  expectedDurationSeconds?: number;
  onProgress?: (progress: number) => void;
}

export class FFmpegEncoder {
  async encode(options: EncodeOptions): Promise<void> {
    const {
      framesDir,
      outputPath,
      fps,
      audioPath,
      crf = 18,
      expectedDurationSeconds,
      onProgress,
    } = options;
    const args = [
      '-y',
      '-framerate',
      String(fps),
      '-i',
      path.join(framesDir, 'frame_%06d.png'),
    ];

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
      '-progress',
      'pipe:2',
      '-nostats',
      '-vf',
      'scale=trunc(iw/2)*2:trunc(ih/2)*2',
      outputPath,
    );

    await new Promise<void>((resolve, reject) => {
      const child = spawn('ffmpeg', args);
      let stderr = '';
      let progressBuffer = '';

      child.stderr.on('data', (chunk) => {
        const text = chunk.toString();
        stderr += text;
        progressBuffer += text;

        const lines = progressBuffer.split('\n');
        progressBuffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!expectedDurationSeconds || !onProgress) {
            continue;
          }

          if (line.startsWith('out_time_ms=')) {
            const rawValue = Number.parseInt(line.slice('out_time_ms='.length), 10);
            if (!Number.isFinite(rawValue) || expectedDurationSeconds <= 0) {
              continue;
            }

            const seconds = rawValue / 1_000_000;
            const progress = Math.max(0, Math.min(1, seconds / expectedDurationSeconds));
            onProgress(progress);
          }

          if (line === 'progress=end') {
            onProgress(1);
          }
        }
      });

      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) {
          onProgress?.(1);
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
