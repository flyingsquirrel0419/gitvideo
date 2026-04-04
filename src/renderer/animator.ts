import * as fs from 'node:fs';
import * as path from 'node:path';
import { fork, type ForkOptions } from 'node:child_process';
import { type CommitEdge, type CommitGraph } from '../graph/types';
import { FrameRenderer } from './frameRenderer';
import { type AnimationFrame, type RenderConfig } from './types';
import { type ActivatedEdge, type RenderWorkerData, type RenderWorkerMessage } from './workerTypes';

export class Animator {
  private readonly renderer: FrameRenderer;

  constructor(
    private readonly graph: CommitGraph,
    private readonly config: RenderConfig,
  ) {
    this.renderer = new FrameRenderer(graph, config);
  }

  async generateFrames(
    outputDir: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    fs.mkdirSync(outputDir, { recursive: true });

    const animOrder = [...this.graph.orderedShas].reverse();
    const totalFrames = animOrder.length * this.config.framesPerCommit + this.config.fps;
    const activatedEdges = this.buildActivatedEdges(animOrder);
    const workerCount = this.resolveWorkerCount(animOrder.length);

    if (workerCount <= 1) {
      this.generateFramesSequential(outputDir, animOrder, activatedEdges, totalFrames, onProgress);
      return;
    }

    await this.generateFramesParallel(
      outputDir,
      animOrder,
      activatedEdges,
      totalFrames,
      workerCount,
      onProgress,
    );
  }

  private generateFramesSequential(
    outputDir: string,
    animOrder: string[],
    activatedEdges: ActivatedEdge[],
    totalFrames: number,
    onProgress?: (current: number, total: number) => void,
  ): void {
    const visibleNodes = new Set<string>();
    const visibleEdges: CommitEdge[] = [];
    let edgeIndex = 0;
    let frameIndex = 0;

    for (let commitIndex = 0; commitIndex < animOrder.length; commitIndex += 1) {
      const sha = animOrder[commitIndex];
      visibleNodes.add(sha);

      while (edgeIndex < activatedEdges.length && activatedEdges[edgeIndex].activationIndex <= commitIndex) {
        visibleEdges.push(activatedEdges[edgeIndex].edge);
        edgeIndex += 1;
      }

      for (let step = 0; step < this.config.framesPerCommit; step += 1) {
        const frame: AnimationFrame = {
          frameIndex,
          visibleNodeShas: visibleNodes,
          visibleEdges,
          highlightSha: sha,
          progress: (step + 1) / this.config.framesPerCommit,
        };

        this.writeFrame(outputDir, frameIndex, frame);
        frameIndex += 1;
        onProgress?.(frameIndex, totalFrames);
      }
    }

    const finalFrame: AnimationFrame = {
      frameIndex,
      visibleNodeShas: visibleNodes,
      visibleEdges,
      highlightSha: null,
      progress: 1,
    };

    for (let holdIndex = 0; holdIndex < this.config.fps; holdIndex += 1) {
      this.writeFrame(outputDir, frameIndex, finalFrame);
      frameIndex += 1;
      onProgress?.(frameIndex, totalFrames);
    }
  }

  private async generateFramesParallel(
    outputDir: string,
    animOrder: string[],
    activatedEdges: ActivatedEdge[],
    totalFrames: number,
    workerCount: number,
    onProgress?: (current: number, total: number) => void,
  ): Promise<void> {
    const ranges = this.partitionCommitRanges(animOrder.length, workerCount);
    let completedFrames = 0;

    await Promise.all(
      ranges.map(async ([startCommitIndex, endCommitIndex]) => {
        await this.runWorker({
          graph: this.graph,
          config: this.config,
          outputDir,
          animOrder,
          activatedEdges,
          startCommitIndex,
          endCommitIndex,
        }, (frameDelta) => {
          completedFrames += frameDelta;
          onProgress?.(completedFrames, totalFrames);
        });
      }),
    );
  }

  private buildActivatedEdges(animOrder: string[]): ActivatedEdge[] {
    const orderIndex = new Map(animOrder.map((sha, index) => [sha, index]));
    return this.graph.edges
      .flatMap((edge) => {
        const fromIndex = orderIndex.get(edge.fromSha);
        const toIndex = orderIndex.get(edge.toSha);
        if (fromIndex === undefined || toIndex === undefined) {
          return [];
        }

        return [{
          edge,
          activationIndex: Math.max(fromIndex, toIndex),
        }];
      })
      .sort((left, right) => left.activationIndex - right.activationIndex);
  }

  private partitionCommitRanges(commitCount: number, workerCount: number): Array<[number, number]> {
    const partitions = Math.min(Math.max(workerCount, 1), commitCount);
    const ranges: Array<[number, number]> = [];
    let start = 0;

    for (let index = 0; index < partitions; index += 1) {
      const remainingCommits = commitCount - start;
      const remainingPartitions = partitions - index;
      const size = Math.ceil(remainingCommits / remainingPartitions);
      const end = start + size;
      ranges.push([start, end]);
      start = end;
    }

    return ranges;
  }

  private resolveWorkerCount(commitCount: number): number {
    if (commitCount <= 1) {
      return 1;
    }

    return Math.min(Math.max(this.config.renderWorkers, 1), commitCount);
  }

  private runWorker(
    workerData: RenderWorkerData,
    onProgress: (completedFrames: number) => void,
  ): Promise<void> {
    const workerPath = this.resolveWorkerPath();
    const worker = fork(workerPath, [], this.resolveWorkerOptions());

    return new Promise<void>((resolve, reject) => {
      let settled = false;

      const finalize = (handler: () => void) => {
        if (settled) {
          return;
        }
        settled = true;
        handler();
      };

      worker.on('message', (message: RenderWorkerMessage) => {
        if (message.type === 'progress') {
          onProgress(message.completedFrames);
          return;
        }

        if (message.type === 'error') {
          finalize(() => reject(new Error(message.message)));
          return;
        }

        if (message.type === 'done') {
          finalize(() => resolve());
        }
      });

      worker.on('error', (error) => {
        finalize(() => reject(error));
      });

      worker.on('exit', (code) => {
        if (settled) {
          return;
        }

        if (code === 0) {
          finalize(() => resolve());
          return;
        }

        finalize(() => reject(new Error(`Render worker exited with code ${code}`)));
      });

      worker.send(workerData);
    });
  }

  private resolveWorkerPath(): string {
    const extension = __filename.endsWith('.ts') ? 'ts' : 'js';
    return path.join(__dirname, `renderWorker.${extension}`);
  }

  private resolveWorkerOptions(): ForkOptions {
    if (__filename.endsWith('.ts')) {
      return {
        execArgv: ['-r', 'ts-node/register'],
        serialization: 'advanced',
      };
    }

    return {
      serialization: 'advanced',
    };
  }

  private writeFrame(outputDir: string, frameIndex: number, frame: AnimationFrame): void {
    const buffer = this.renderer.renderFrame(frame);
    const filename = path.join(outputDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
    fs.writeFileSync(filename, buffer);
  }
}
