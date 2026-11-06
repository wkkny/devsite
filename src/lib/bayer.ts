/**
 * The 4x4 ordered-dither (Bayer) matrix the banner draws with, normalized to 0 to 1. Effects that
 * reveal cells one at a time follow its order, so they read as the same material as the banner.
 */
export const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((value) => (value + 0.5) / 16)

/** The threshold for a cell at column `x`, row `y`. */
export const bayer4 = (x: number, y: number) => BAYER4[(y % 4) * 4 + (x % 4)]
