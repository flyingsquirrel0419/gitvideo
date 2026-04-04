import { type CommitEdge } from '../graph/types';

export interface Theme {
  background: string;
  nodeColors: string[];
  nodeRadius: number;
  edgeWidth: number;
  mergeNodeColor: string;
  textColor: string;
  labelFontSize: number;
  shaFontSize: number;
  fontFamily: string;
}

export interface RenderConfig {
  width: number;
  height: number;
  fps: number;
  framesPerCommit: number;
  renderWorkers: number;
  theme: Theme;
}

export interface AnimationFrame {
  frameIndex: number;
  visibleNodeShas: Set<string>;
  visibleEdges: CommitEdge[];
  highlightSha: string | null;
  progress: number;
}
