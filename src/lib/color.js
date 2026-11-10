/**
 * Colour helpers. The whole palette is derived from a single hue (0–360) so
 * every status / owner / project gets a consistent soft background, strong
 * foreground and saturated dot.
 */
export const INK = 'oklch(0.23 0.015 265)';
export const MUTED = 'oklch(0.52 0.012 265)';
export const RED = 'oklch(0.55 0.18 25)';
export const AMBER = 'oklch(0.72 0.14 70)';
export const BLUE = 'oklch(0.55 0.15 265)';
export const GREEN = 'oklch(0.58 0.13 150)';
export const GREEN_TEXT = 'oklch(0.5 0.13 150)';
export const PURPLE = 'oklch(0.55 0.15 300)';
export const PRIMARY = 'oklch(0.5 0.17 265)';

/** Standard soft pill tone for a hue. */
export const tone = (h = 265) => ({
  bg: `oklch(0.95 0.035 ${h})`,
  fg: `oklch(0.42 0.12 ${h})`,
  dot: `oklch(0.62 0.15 ${h})`,
});

/** Slightly stronger tone (health, badges). */
export const toneStrong = (h = 265) => ({
  bg: `oklch(0.95 0.04 ${h})`,
  fg: `oklch(0.42 0.13 ${h})`,
  dot: `oklch(0.62 0.17 ${h})`,
});

/** Avatar colours. */
export const avatarTone = (h = 265) => ({ bg: `oklch(0.92 0.05 ${h})`, fg: `oklch(0.38 0.12 ${h})` });

/** Project accent colour. */
export const projectColor = (p) => `oklch(0.66 0.13 ${p ? p.h : 265})`;

/** Utilisation bar colour: over → red, near → amber, else blue. */
export const barColor = (x) => (x > 1 ? RED : x > 0.85 ? AMBER : BLUE);
