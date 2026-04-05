import { describe, expect, it } from 'vitest';
import { calculateViewportOffsetY, VERTICAL_VIEWPORT_MARGIN } from '../../src/renderer/camera';

describe('calculateViewportOffsetY', () => {
  it('does not scroll when the graph already fits in the viewport', () => {
    expect(calculateViewportOffsetY(300, 480, 200)).toBe(0);
  });

  it('centers the focus point when there is enough room to scroll', () => {
    const offset = calculateViewportOffsetY(2000, 400, 1000);
    const availableHeight = 400 - VERTICAL_VIEWPORT_MARGIN * 2;
    expect(offset).toBe(1000 - availableHeight / 2);
  });

  it('clamps near the end of the history', () => {
    const offset = calculateViewportOffsetY(2000, 400, 1900);
    const availableHeight = 400 - VERTICAL_VIEWPORT_MARGIN * 2;
    expect(offset).toBe(2000 - availableHeight);
  });
});
