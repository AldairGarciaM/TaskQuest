import { describe, expect, it } from "vitest";

import { EDGE_PX, edgeScrollDelta, MAX_SCROLL_PX, movedPastTolerance } from "@/components/calendar/touch";

describe("edgeScrollDelta", () => {
  // A scroll area visible from y = 100 to y = 800.
  const top = 100;
  const bottom = 800;

  it("doesn't scroll while the finger is away from the edges", () => {
    expect(edgeScrollDelta(450, top, bottom)).toBe(0);
    expect(edgeScrollDelta(top + EDGE_PX, top, bottom)).toBe(0);
    expect(edgeScrollDelta(bottom - EDGE_PX, top, bottom)).toBe(0);
  });

  it("scrolls up near the top and down near the bottom, faster closer to the edge", () => {
    const nearTop = edgeScrollDelta(top + EDGE_PX / 2, top, bottom);
    expect(nearTop).toBeCloseTo(-MAX_SCROLL_PX / 2);
    expect(edgeScrollDelta(top + 4, top, bottom)).toBeLessThan(nearTop);
    expect(edgeScrollDelta(bottom - EDGE_PX / 2, top, bottom)).toBeCloseTo(MAX_SCROLL_PX / 2);
  });

  it("caps the speed past the edges", () => {
    expect(edgeScrollDelta(0, top, bottom)).toBe(-MAX_SCROLL_PX);
    expect(edgeScrollDelta(2000, top, bottom)).toBe(MAX_SCROLL_PX);
  });
});

describe("movedPastTolerance", () => {
  it("treats a small wobble as holding still and a real move as a scroll", () => {
    expect(movedPastTolerance(10, 10, 14, 13)).toBe(false);
    expect(movedPastTolerance(10, 10, 10, 30)).toBe(true);
  });
});
