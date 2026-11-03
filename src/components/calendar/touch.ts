/** Hold this long without moving to pick a task up; moving earlier scrolls the page as usual. */
export const LONG_PRESS_MS = 350;
export const MOVE_TOLERANCE_PX = 8;
/** Near the scroll area's edges the page scrolls by itself, up to this many px per frame. */
export const EDGE_PX = 72;
export const MAX_SCROLL_PX = 16;

/**
 * How far to scroll this frame while a finger carries a task at `y`, given the visible top and
 * bottom of the scroll area: faster the closer it gets to (or past) an edge, none in the middle.
 */
export function edgeScrollDelta(y: number, top: number, bottom: number): number {
  if (y < top + EDGE_PX) return -MAX_SCROLL_PX * Math.min(1, (top + EDGE_PX - y) / EDGE_PX);
  if (y > bottom - EDGE_PX) return MAX_SCROLL_PX * Math.min(1, (y - bottom + EDGE_PX) / EDGE_PX);
  return 0;
}

/** Whether a finger that started at one point and is now at another has moved enough to be a scroll. */
export function movedPastTolerance(startX: number, startY: number, x: number, y: number): boolean {
  return Math.hypot(x - startX, y - startY) > MOVE_TOLERANCE_PX;
}
