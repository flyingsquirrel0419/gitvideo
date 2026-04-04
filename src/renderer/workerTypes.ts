import { type CommitEdge, type CommitGraph } from '../graph/types';
import { type RenderConfig } from './types';

export interface ActivatedEdge {
  edge: CommitEdge;
  activationIndex: number;
}

export interface RenderWorkerData {
  graph: CommitGraph;
  config: RenderConfig;
  outputDir: string;
  animOrder: string[];
  activatedEdges: ActivatedEdge[];
  startCommitIndex: number;
  endCommitIndex: number;
}

export interface RenderWorkerProgressMessage {
  type: 'progress';
  completedFrames: number;
}

export interface RenderWorkerDoneMessage {
  type: 'done';
}

export interface RenderWorkerErrorMessage {
  type: 'error';
  message: string;
}

export type RenderWorkerMessage =
  | RenderWorkerProgressMessage
  | RenderWorkerDoneMessage
  | RenderWorkerErrorMessage;
