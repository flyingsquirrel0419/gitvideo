import { createCanvas, type Canvas, type CanvasRenderingContext2D } from 'canvas';
import { type CommitEdge, type CommitGraph, type CommitNode } from '../graph/types';
import { VERTICAL_VIEWPORT_MARGIN } from './camera';
import { type AnimationFrame, type RenderConfig } from './types';

interface Point {
  x: number;
  y: number;
}

export class FrameRenderer {
  private static readonly VIEWPORT_MARGIN = 20;
  private static readonly GRID_SPACING = 48;
  private readonly canvas: Canvas;
  private readonly ctx: CanvasRenderingContext2D;
  private currentViewportOffsetY = 0;

  constructor(
    private readonly graph: CommitGraph,
    private readonly config: RenderConfig,
  ) {
    this.canvas = createCanvas(config.width, config.height);
    this.ctx = this.canvas.getContext('2d');
  }

  renderFrame(frame: AnimationFrame): Buffer {
    this.currentViewportOffsetY = frame.viewportOffsetY;
    this.drawBackground(frame);

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
    const isHighlight = highlightSha === edge.fromSha;

    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = edge.laneColor;
    ctx.lineWidth = Math.max(this.config.theme.edgeWidth * scale * (isHighlight ? 1.4 : 1), 1);
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.globalAlpha = isHighlight ? 0.95 : 0.45;
    if (isHighlight) {
      ctx.shadowColor = this.applyAlpha(edge.laneColor, 0.8);
      ctx.shadowBlur = 18 * scale;
    }

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
    const easedProgress = this.easeOutCubic(progress);
    const { x, y } = this.transformPoint(node.x, node.y);
    const laneColor = theme.nodeColors[node.laneIndex % theme.nodeColors.length];
    const color = node.isMerge ? theme.mergeNodeColor : laneColor;
    const radius = Math.max(theme.nodeRadius * easedProgress * scale, 1);

    ctx.save();
    if (isHighlight && progress > 0.35) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 24 * scale;
    }

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = theme.background;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    if (isHighlight) {
      this.drawNodePulse(x, y, radius, color, easedProgress);
    }

    if (progress <= 0.35) {
      return;
    }

    const alpha = this.easeOutCubic((progress - 0.35) / 0.65);
    const message = node.message.length > 45 ? `${node.message.slice(0, 45)}...` : node.message;
    const shaFontSize = this.getScaledFontSize(theme.shaFontSize, 8);
    const labelFontSize = this.getScaledFontSize(theme.labelFontSize, 9);
    const gap = Math.max(6 * scale, 4);
    const lift = (1 - alpha) * 10;

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
      const cardX = preferredLeft - 10;
      const cardWidth = Math.max(shaWidth + gap + this.measureTextWidth(fittedMessage, `${labelFontSize}px ${theme.fontFamily}`) + 18, 56);
      this.drawTextSurface(cardX, textY - 17 - lift, cardWidth, 30);
      ctx.font = `${shaFontSize}px ${theme.fontFamily}`;
      ctx.fillText(node.shortSha, preferredLeft, textY - lift);
      ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
      ctx.fillText(fittedMessage, preferredLeft + shaWidth + gap, textY - lift);
      ctx.restore();
      return;
    }

    ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
    const fittedMessageWidth = ctx.measureText(fittedMessage).width;
    const rightEdge = Math.max(leftAnchor, FrameRenderer.VIEWPORT_MARGIN + shaWidth + gap + fittedMessageWidth);
    const leftCardX = Math.max(rightEdge - (shaWidth + gap + fittedMessageWidth + 18), FrameRenderer.VIEWPORT_MARGIN);
    this.drawTextSurface(leftCardX, textY - 17 - lift, rightEdge - leftCardX + 10, 30);
    ctx.font = `${labelFontSize}px ${theme.fontFamily}`;
    ctx.textAlign = 'right';
    ctx.fillText(fittedMessage, rightEdge, textY - lift);
    ctx.font = `${shaFontSize}px ${theme.fontFamily}`;
    ctx.fillText(node.shortSha, Math.max(rightEdge - fittedMessageWidth - gap, FrameRenderer.VIEWPORT_MARGIN + shaWidth), textY - lift);
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

  private drawBackground(frame: AnimationFrame): void {
    const { ctx } = this;
    const { width, height, theme } = this.config;
    const gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, theme.background);
    gradient.addColorStop(1, theme.backgroundAccent);
    ctx.save();
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    const glow = ctx.createRadialGradient(
      width * 0.75,
      height * 0.2,
      0,
      width * 0.75,
      height * 0.2,
      width * 0.8,
    );
    glow.addColorStop(0, this.applyAlpha(theme.backgroundGlow, 0.18));
    glow.addColorStop(1, this.applyAlpha(theme.backgroundGlow, 0));
    ctx.save();
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();

    const gridOffsetY = -(this.currentViewportOffsetY * 0.18 % FrameRenderer.GRID_SPACING);
    ctx.save();
    ctx.strokeStyle = this.applyAlpha(theme.gridColor, 0.08);
    ctx.lineWidth = 1;
    for (let y = gridOffsetY; y < height; y += FrameRenderer.GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    for (let x = 0; x < width; x += FrameRenderer.GRID_SPACING) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }
    ctx.restore();

    if (frame.highlightSha) {
      const node = this.graph.nodes.get(frame.highlightSha);
      if (node) {
        const point = this.transformPoint(node.x, node.y);
        const spot = ctx.createRadialGradient(point.x, point.y, 0, point.x, point.y, width * 0.32);
        spot.addColorStop(0, this.applyAlpha(theme.glowColor, 0.14));
        spot.addColorStop(1, this.applyAlpha(theme.glowColor, 0));
        ctx.save();
        ctx.fillStyle = spot;
        ctx.fillRect(0, 0, width, height);
        ctx.restore();
      }
    }

    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.35,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.75,
    );
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.save();
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  private drawNodePulse(x: number, y: number, radius: number, color: string, progress: number): void {
    const { ctx } = this;
    const pulseRadius = radius + 10 + (1 - progress) * 12;
    ctx.save();
    ctx.globalAlpha = 0.18 * progress;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x, y, pulseRadius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  private drawTextSurface(x: number, y: number, width: number, height: number): void {
    const { ctx } = this;
    ctx.save();
    ctx.fillStyle = this.config.theme.surfaceColor;
    this.fillRoundedRect(x, y, width, height, 10);
    ctx.strokeStyle = this.applyAlpha(this.config.theme.surfaceBorder, 0.7);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }

  private transformPoint(x: number, y: number): Point {
    const scale = this.getHorizontalScale();
    const offsetX = Math.max((this.config.width - this.graph.totalWidth * scale) / 2, 0);
    const offsetY = VERTICAL_VIEWPORT_MARGIN - this.currentViewportOffsetY;
    return { x: x * scale + offsetX, y: y + offsetY };
  }

  private getHorizontalScale(): number {
    const availableWidth = Math.max(this.config.width - FrameRenderer.VIEWPORT_MARGIN * 2, 1);
    return Math.min(1, availableWidth / Math.max(this.graph.totalWidth, 1));
  }

  private getScaledFontSize(size: number, minimum: number): number {
    return Math.max(Math.round(size * this.getHorizontalScale()), minimum);
  }

  private measureTextWidth(text: string, font: string): number {
    const { ctx } = this;
    ctx.save();
    ctx.font = font;
    const width = ctx.measureText(text).width;
    ctx.restore();
    return width;
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

  private easeOutCubic(value: number): number {
    const clamped = this.clamp(value, 0, 1);
    return 1 - (1 - clamped) ** 3;
  }

  private applyAlpha(color: string, alpha: number): string {
    if (!color.startsWith('#')) {
      return color;
    }

    const hex = color.slice(1);
    const normalized = hex.length === 3
      ? hex.split('').map((char) => char + char).join('')
      : hex;
    const red = Number.parseInt(normalized.slice(0, 2), 16);
    const green = Number.parseInt(normalized.slice(2, 4), 16);
    const blue = Number.parseInt(normalized.slice(4, 6), 16);
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }
}
