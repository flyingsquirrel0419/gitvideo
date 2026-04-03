import { type Theme } from '../renderer/types';
import { type CommitEdge, type CommitGraph } from './types';

export const LANE_WIDTH = 40;
export const ROW_HEIGHT = 60;
export const PADDING_TOP = 80;
export const PADDING_LEFT = 60;

export class LayoutCalculator {
  calculate(graph: CommitGraph, theme: Theme): CommitGraph {
    const activeLanes: Array<string | null> = [];

    for (let rowIndex = 0; rowIndex < graph.orderedShas.length; rowIndex += 1) {
      const sha = graph.orderedShas[rowIndex];
      const node = graph.nodes.get(sha);
      if (!node) {
        continue;
      }

      let lane = activeLanes.indexOf(sha);
      if (lane === -1) {
        lane = activeLanes.indexOf(null);
        if (lane === -1) {
          lane = activeLanes.length;
          activeLanes.push(null);
        }
      }

      this.clearReservedCommit(activeLanes, sha);

      node.laneIndex = lane;
      node.x = PADDING_LEFT + lane * LANE_WIDTH;
      node.y = PADDING_TOP + rowIndex * ROW_HEIGHT;

      if (node.parentShas.length > 0) {
        activeLanes[lane] = node.parentShas[0] ?? null;
      } else {
        activeLanes[lane] = null;
      }

      for (const parentSha of node.parentShas.slice(1)) {
        let extraLane = activeLanes.indexOf(null);
        if (extraLane === -1) {
          extraLane = activeLanes.length;
          activeLanes.push(parentSha);
        } else {
          activeLanes[extraLane] = parentSha;
        }
      }
    }

    const edges: CommitEdge[] = [];
    for (const sha of graph.orderedShas) {
      const node = graph.nodes.get(sha);
      if (!node) {
        continue;
      }

      for (const parentSha of node.parentShas) {
        const parent = graph.nodes.get(parentSha);
        if (!parent) {
          continue;
        }

        edges.push({
          fromSha: sha,
          toSha: parentSha,
          fromX: node.x,
          fromY: node.y,
          toX: parent.x,
          toY: parent.y,
          isMerge: node.isMerge,
          laneColor: theme.nodeColors[node.laneIndex % theme.nodeColors.length],
        });
      }
    }

    const laneCount = graph.nodes.size === 0
      ? 0
      : Math.max(...Array.from(graph.nodes.values()).map((node) => node.laneIndex)) + 1;

    return {
      ...graph,
      edges,
      laneCount,
      totalWidth: PADDING_LEFT * 2 + laneCount * LANE_WIDTH,
      totalHeight: PADDING_TOP * 2 + graph.orderedShas.length * ROW_HEIGHT,
    };
  }

  private clearReservedCommit(activeLanes: Array<string | null>, sha: string): void {
    for (let index = 0; index < activeLanes.length; index += 1) {
      if (activeLanes[index] === sha) {
        activeLanes[index] = null;
      }
    }
  }
}
