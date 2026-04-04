import * as fs from 'node:fs';
import * as path from 'node:path';
import { type CommitGraph } from '../graph/types';
import { FrameRenderer } from './frameRenderer';
import { type AnimationFrame, type RenderConfig } from './types';

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
    const visibleNodes = new Set<string>();
    let frameIndex = 0;
    const totalFrames = animOrder.length * this.config.framesPerCommit + this.config.fps;

    for (let commitIndex = 0; commitIndex < animOrder.length; commitIndex += 1) {
      const sha = animOrder[commitIndex];
      visibleNodes.add(sha);

      for (let step = 0; step < this.config.framesPerCommit; step += 1) {
        const progress = (step + 1) / this.config.framesPerCommit;
        const frame: AnimationFrame = {
          frameIndex,
          visibleNodeShas: new Set(visibleNodes),
          visibleEdges: this.graph.edges.filter(
            (edge) => visibleNodes.has(edge.fromSha) && visibleNodes.has(edge.toSha),
          ),
          highlightSha: sha,
          progress,
        };

        this.writeFrame(outputDir, frameIndex, frame);
        frameIndex += 1;
        onProgress?.(frameIndex, totalFrames);
      }
    }

    const finalFrame: AnimationFrame = {
      frameIndex,
      visibleNodeShas: new Set(visibleNodes),
      visibleEdges: this.graph.edges.filter(
        (edge) => visibleNodes.has(edge.fromSha) && visibleNodes.has(edge.toSha),
      ),
      highlightSha: null,
      progress: 1,
    };

    for (let holdIndex = 0; holdIndex < this.config.fps; holdIndex += 1) {
      this.writeFrame(outputDir, frameIndex, finalFrame);
      frameIndex += 1;
      onProgress?.(frameIndex, totalFrames);
    }
  }

  private writeFrame(outputDir: string, frameIndex: number, frame: AnimationFrame): void {
    const buffer = this.renderer.renderFrame(frame);
    const filename = path.join(outputDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
    fs.writeFileSync(filename, buffer);
  }
}
