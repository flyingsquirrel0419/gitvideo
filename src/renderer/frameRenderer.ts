import { createCanvas, type Canvas, type CanvasRenderingContext2D } from 'canvas';
import { type CommitEdge, type CommitGraph, type CommitNode } from '../graph/types';
import { type AnimationFrame, type RenderConfig } from './types';

interface Point {
  x: number;
  y: number;
}

export class FrameRenderer {
  private static readonly VIEWPORT_MARGIN = 20;
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
    const scale = this.getHorizontalScale();
    const from = this.transformPoint(edge.fromX, edge.fromY);
    const to = this.transformPoint(edge.toX, edge.toY);

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = edge.laneColor;
    ctx.lineWidth = Math.max(this.config.theme.edgeWidth * scale, 1);
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
    const scale = this.getHorizontalScale();
    const { x, y } = this.transformPoint(node.x, node.y);
    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];
    const color = node.isMerge ? theme.mergeNodeColor : laneColor;
    const radius = Math.max(theme.nodeRadius * progress * scale, 1);

    ctx.save();
    if (isHighlight && progress > 0.5) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 15 * scale;
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
    const shaFontSize = this.getScaledFontSize(theme.shaFontSize, 8);
    const labelFontSize = this.getScaledFontSize(theme.labelFontSize, 9);
    const gap = Math.max(6 * scale, 4);

    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = theme.textColor;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.font = `${shaFontSize}px ${theme.fontFamily}`;
    const shaWidth = ctx.measureText(node.shortSha).width;
    ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
    const preferredLeft = x + radius + 6;
    const rightSpace = this.config.width - FrameRenderer.VIEWPORT_MARGIN - preferredLeft;
    const leftAnchor = x - radius - 6;
    const leftSpace = leftAnchor - FrameRenderer.VIEWPORT_MARGIN;
    const textY = y + 1;
    const drawRight = rightSpace >= leftSpace;
    const availableWidth = Math.max((drawRight ? rightSpace : leftSpace) - shaWidth - gap, 0);
    const fittedMessage = this.fitTextToWidth(message, availableWidth, `${labelFontSize}px ${theme.fontFamily}`);

    if (drawRight) {
      ctx.font = `${shaFontSize}px ${theme.fontFamily}`;
      ctx.fillText(node.shortSha, preferredLeft, textY);
      ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
      ctx.fillText(fittedMessage, preferredLeft + shaWidth + gap, textY);
      ctx.restore();
      return;
    }

    ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
    const fittedMessageWidth = ctx.measureText(fittedMessage).width;
    const rightEdge = Math.max(leftAnchor, FrameRenderer.VIEWPORT_MARGIN + shaWidth + gap + fittedMessageWidth);
    ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillText(fittedMessage, rightEdge, textY);
    ctx.font = `${shaFontSize}px ${theme.fontFamily}`;
    ctx.fillText(node.shortSha, Math.max(rightEdge - fittedMessageWidth - gap, FrameRenderer.VIEWPORT_MARGIN + shaWidth), textY);
    ctx.restore();
  }

  private drawBranchLabel(node: CommitNode): void {
    const { ctx } = this;
    const theme = this.config.theme;
    const scale = this.getHorizontalScale();
    const point = this.transformPoint(node.x, node.y);
    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];
    const fontSize = this.getScaledFontSize(9, 7);

    let offsetY = -theme.nodeRadius * scale - 6;

    for (const name of node.branchNames.slice(0, 2)) {
      ctx.save();
      ctx.font = `bold ${fontSize}px ${theme.fontFamily}`;
      const textWidth = ctx.measureText(name).width;
      const width = Math.ceil(textWidth + 10 * scale);
      const height = Math.max(Math.round(16 * scale), 12);
      const x = this.clamp(
        point.x - width / 2,
        FrameRenderer.VIEWPORT_MARGIN,
        this.config.width - width - FrameRenderer.VIEWPORT_MARGIN,
      );
      const y = point.y + offsetY - height;

      ctx.fillStyle = laneColor;
      this.fillRoundedRect(x, y, width, height, Math.max(3 * scale, 2));

      ctx.fillStyle = '#ffffff';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(name, x + width / 2, y + height / 2 + 1);
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
    const scale = this.getHorizontalScale();
    const offsetX = Math.max((this.config.width - this.graph.totalWidth * scale) / 2, 0);
    const offsetY = 20;
    return { x: x * scale + offsetX, y: y + offsetY };
  }

  private getHorizontalScale(): number {
    const availableWidth = Math.max(this.config.width - FrameRenderer.VIEWPORT_MARGIN * 2, 1);
    return Math.min(1, availableWidth / Math.max(this.graph.totalWidth, 1));
  }

  private getScaledFontSize(size: number, minimum: number): number {
    return Math.max(Math.round(size * this.getHorizontalScale()), minimum);
  }

  private fitTextToWidth(text: string, maxWidth: number, font: string): string {
    if (maxWidth <= 0) {
      return '';
    }

    const { ctx } = this;
    ctx.save();
    ctx.font = font;

    if (ctx.measureText(text).width <= maxWidth) {
      ctx.restore();
      return text;
    }

    const ellipsis = '...';
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (ellipsisWidth >= maxWidth) {
      ctx.restore();
      return '';
    }

    let end = text.length;
    while (end > 0) {
      const candidate = `${text.slice(0, end)}${ellipsis}`;
      if (ctx.measureText(candidate).width <= maxWidth) {
        ctx.restore();
        return candidate;
      }
      end -= 1;
    }

    ctx.restore();
    return '';
  }

  private clamp(value: number, minimum: number, maximum: number): number {
    return Math.min(Math.max(value, minimum), maximum);
  }
}
