export const VERTICAL_VIEWPORT_MARGIN = 20;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function easeInOutCubic(value: number): number {
  const clamped = clamp(value, 0, 1);
  if (clamped < 0.5) {
    return 4 * clamped ** 3;
  }

  return 1 - ((-2 * clamped + 2) ** 3) / 2;
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

export function interpolateViewportOffsetY(
  fromOffset: number,
  toOffset: number,
  progress: number,
): number {
  const easedProgress = easeInOutCubic(progress);
  return fromOffset + (toOffset - fromOffset) * easedProgress;
}
