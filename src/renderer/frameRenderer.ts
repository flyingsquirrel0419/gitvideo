import { createCanvas, type Canvas, type CanvasRenderingContext2D } from 'canvas';
import { type CommitEdge, type CommitGraph, type CommitNode } from '../graph/types';
import { type AnimationFrame, type RenderConfig } from './types';

interface Point {
  x: number;
  y: number;
}

export class FrameRenderer {
  private readonly canvas: Canvas;
  private readonly ctx: CanvasRenderingContext2D;

  constructor(
    private readonly graph: CommitGraph,
    private readonly config: RenderConfig,
  ) {
    this.canvas = createCanvas(config.width, config.height);
    this.ctx = this.canvas.getContext('2d');
  }

  renderFrame(frame: AnimationFrame): Buffer {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = this.config.theme.background;
    ctx.fillRect(0, 0, this.config.width, this.config.height);
    ctx.restore();

    for (const edge of frame.visibleEdges) {
      this.drawEdge(edge, frame.highlightSha);
    }

    for (const sha of frame.visibleNodeShas) {
      const node = this.graph.nodes.get(sha);
      if (!node) {
        continue;
      }

      const isHighlight = sha === frame.highlightSha;
      const progress = isHighlight ? frame.progress : 1;
      this.drawNode(node, progress, isHighlight);
    }

    for (const sha of frame.visibleNodeShas) {
      const node = this.graph.nodes.get(sha);
      if (node && node.branchNames.length > 0) {
        this.drawBranchLabel(node);
      }
    }

    return this.canvas.toBuffer('image/png');
  }

  private drawEdge(edge: CommitEdge, highlightSha: string | null): void {
    const { ctx } = this;
    const from = this.transformPoint(edge.fromX, edge.fromY);
    const to = this.transformPoint(edge.toX, edge.toY);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = edge.laneColor;
    ctx.lineWidth = this.config.theme.edgeWidth;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = highlightSha === edge.fromSha ? 1 : 0.6;

    if (from.x === to.x) {
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
    } else {
      const midY = (from.y + to.y) / 2;
      ctx.moveTo(from.x, from.y);
      ctx.bezierCurveTo(from.x, midY, to.x, midY, to.x, to.y);
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawNode(node: CommitNode, progress: number, isHighlight: boolean): void {
    const { ctx } = this;
    const theme = this.config.theme;
    const { x, y } = this.transformPoint(node.x, node.y);
    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];
    const color = node.isMerge ? theme.mergeNodeColor : laneColor;
    const radius = Math.max(theme.nodeRadius * progress, 1);

    ctx.save();
    if (isHighlight && progress > 0.5) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 15;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = theme.background;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    if (progress <= 0.7) {
      return;
    }

    const alpha = (progress - 0.7) / 0.3;
    const message = node.message.length > 45 ? `${node.message.slice(0, 45)}...` : node.message;

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.textColor;
    ctx.font = `${theme.shaFontSize}px ${theme.fontFamily}`;
    ctx.fillText(node.shortSha, x + theme.nodeRadius + 6, y + 4);
    ctx.font = `${theme.labelFontSize}px ${theme.fontFamily}`;
    ctx.fillText(message, x + theme.nodeRadius + 55, y + 4);
    ctx.restore();
  }

  private drawBranchLabel(node: CommitNode): void {
    const { ctx } = this;
    const theme = this.config.theme;
    const point = this.transformPoint(node.x, node.y);
    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];

    let offsetY = -theme.nodeRadius - 6;

    for (const name of node.branchNames.slice(0, 2)) {
      ctx.save();
      ctx.font = `bold 9px ${theme.fontFamily}`;
      const textWidth = ctx.measureText(name).width;
      const width = Math.ceil(textWidth + 10);
      const height = 16;
      const x = point.x - width / 2;
      const y = point.y + offsetY - height;

      ctx.fillStyle = laneColor;
      this.fillRoundedRect(x, y, width, height, 3);

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.fillText(name, point.x, y + 11);
      ctx.restore();

      offsetY -= height + 4;
    }
  }

  private fillRoundedRect(x: number, y: number, width: number, height: number, radius: number): void {
    const { ctx } = this;
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.fill();
  }

  private transformPoint(x: number, y: number): Point {
    const offsetX = Math.max((this.config.width - this.graph.totalWidth) / 2, 0);
    const offsetY = 20;
    return { x: x + offsetX, y: y + offsetY };
  }
}
