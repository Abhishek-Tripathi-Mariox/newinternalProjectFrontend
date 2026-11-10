/** Deterministic LCG so seed data is stable between reloads. */
export function seeded(seed) {
  let s = seed;
  const r = () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
  const pick = (a) => a[Math.floor(r() * a.length)];
  return { r, pick };
}

export const randomHue = () => Math.floor(Math.random() * 360);

export const uid = (prefix = '') => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);

/** Random Google Meet style link. */
export function genMeet(r = Math.random) {
  const a = 'abcdefghijkmnopqrstuvwxyz';
  const g = (n) => Array.from({ length: n }, () => a[Math.floor(r() * a.length)]).join('');
  return `https://meet.google.com/${g(3)}-${g(4)}-${g(3)}`;
}
