import * as fs from 'node:fs';
import * as path from 'node:path';
import { calculateViewportOffsetY, interpolateViewportOffsetY } from './camera';
import { FrameRenderer } from './frameRenderer';
import { type AnimationFrame } from './types';
import { type ActivatedEdge, type RenderWorkerData, type RenderWorkerMessage } from './workerTypes';

function postMessage(message: RenderWorkerMessage): void {
  if (typeof process.send === 'function') {
    process.send(message);
  }
}

function writeFrame(
  renderer: FrameRenderer,
  outputDir: string,
  frameIndex: number,
  frame: AnimationFrame,
): void {
  const buffer = renderer.renderFrame(frame);
  const filename = path.join(outputDir, `frame_${String(frameIndex).padStart(6, '0')}.png`);
  fs.writeFileSync(filename, buffer);
}

function preloadState(
  animOrder: string[],
  activatedEdges: ActivatedEdge[],
  startCommitIndex: number,
) {
  const visibleNodes = new Set<string>(animOrder.slice(0, startCommitIndex));
  const visibleEdges = activatedEdges
    .filter((entry) => entry.activationIndex < startCommitIndex)
    .map((entry) => entry.edge);

  const nextEdgeIndex = activatedEdges.findIndex((entry) => entry.activationIndex >= startCommitIndex);
  return {
    visibleNodes,
    visibleEdges,
    nextEdgeIndex: nextEdgeIndex === -1 ? activatedEdges.length : nextEdgeIndex,
  };
}

function run(workerData: RenderWorkerData): void {
  const {
    graph,
    config,
    outputDir,
    animOrder,
    activatedEdges,
    startCommitIndex,
    endCommitIndex,
  } = workerData;
  const renderer = new FrameRenderer(graph, config);
  const { visibleNodes, visibleEdges, nextEdgeIndex } = preloadState(
    animOrder,
    activatedEdges,
    startCommitIndex,
  );
  let edgeIndex = nextEdgeIndex;

  for (let commitIndex = startCommitIndex; commitIndex < endCommitIndex; commitIndex += 1) {
    const sha = animOrder[commitIndex];
    const previousSha = commitIndex > 0 ? animOrder[commitIndex - 1] : null;
    visibleNodes.add(sha);

    while (edgeIndex < activatedEdges.length && activatedEdges[edgeIndex].activationIndex <= commitIndex) {
      visibleEdges.push(activatedEdges[edgeIndex].edge);
      edgeIndex += 1;
    }

    for (let step = 0; step < config.framesPerCommit; step += 1) {
      const frameIndex = commitIndex * config.framesPerCommit + step;
      const progress = (step + 1) / config.framesPerCommit;
      const previousY = graph.nodes.get(previousSha ?? '')?.y ?? graph.nodes.get(sha)?.y ?? 0;
      const currentY = graph.nodes.get(sha)?.y ?? previousY;
      const frame: AnimationFrame = {
        frameIndex,
        visibleNodeShas: visibleNodes,
        visibleEdges,
        highlightSha: sha,
        previousHighlightSha: previousSha,
        progress,
        viewportOffsetY: interpolateViewportOffsetY(
          calculateViewportOffsetY(graph.totalHeight, config.height, previousY),
          calculateViewportOffsetY(graph.totalHeight, config.height, currentY),
          progress,
        ),
      };

      writeFrame(renderer, outputDir, frameIndex, frame);
      postMessage({ type: 'progress', completedFrames: 1 });
    }
  }

  if (endCommitIndex === animOrder.length) {
    const frameIndexStart = animOrder.length * config.framesPerCommit;
    const finalFrame: AnimationFrame = {
      frameIndex: frameIndexStart,
      visibleNodeShas: visibleNodes,
      visibleEdges,
      highlightSha: null,
      previousHighlightSha: animOrder.at(-1) ?? null,
      progress: 1,
      viewportOffsetY: calculateViewportOffsetY(
        graph.totalHeight,
        config.height,
        graph.nodes.get(animOrder.at(-1) ?? '')?.y ?? 0,
      ),
    };

    for (let holdIndex = 0; holdIndex < config.fps; holdIndex += 1) {
      writeFrame(renderer, outputDir, frameIndexStart + holdIndex, finalFrame);
      postMessage({ type: 'progress', completedFrames: 1 });
    }
  }

  postMessage({ type: 'done' });
}

try {
  process.once('message', (message) => {
    try {
      run(message as RenderWorkerData);
    } catch (error) {
      const text = error instanceof Error ? error.message : String(error);
      postMessage({ type: 'error', message: text });
      process.exitCode = 1;
    }
  });
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  postMessage({ type: 'error', message });
  process.exitCode = 1;
}
