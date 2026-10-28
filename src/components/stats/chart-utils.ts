/** Rounds an axis maximum up to 1, 2 or 5 times a power of ten (0 → 10). */
export function niceMax(value: number): number {
  if (value <= 0) return 10;
  const power = 10 ** Math.floor(Math.log10(value));
  const step = [1, 2, 5, 10].find((m) => m * power >= value)!;
  return step * power;
}

/** 1,284 → "1.3K"; small numbers stay as they are. */
export function compact(value: number): string {
  return new Intl.NumberFormat("es-MX", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

/**
 * Chart series colors on the slate-900 surface. Validated with the dataviz palette checker
 * (dark mode, adjacent pairs in this order): lightness band, chroma, CVD and contrast all pass.
 * Violet and sky match the personal/team colors used elsewhere in the app.
 */
export const SERIES_COLORS = {
  personal: "#8b5cf6",
  bonus: "#d97706",
  team: "#0284c7",
} as const;
