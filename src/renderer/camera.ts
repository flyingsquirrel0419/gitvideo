export const VERTICAL_VIEWPORT_MARGIN = 20;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function calculateViewportOffsetY(
  totalHeight: number,
  viewportHeight: number,
  focusY: number,
): number {
  const availableHeight = Math.max(viewportHeight - VERTICAL_VIEWPORT_MARGIN * 2, 1);
  const maxOffset = Math.max(totalHeight - availableHeight, 0);
  const targetOffset = focusY - availableHeight / 2;
  return clamp(targetOffset, 0, maxOffset);
}
