/**
 * Column sorting for project lists (rows carry {p, I}). Empty values (no expected date…) always go last.
 * sort = {k, d}: k = column key, d = 1 ascending / -1 descending.
 */
const VALUE = {
  name: ({ p }) => (p.name || '').toLowerCase(),
  project: ({ p }) => (p.name || '').toLowerCase(),
  due: ({ p }) => p.due ?? null,
  dates: ({ p }) => p.due ?? null,
  exp: ({ p }) => p.exp ?? null,
  hours: ({ I }) => I.used,
  health: ({ I }) => (I.score == null ? null : I.score),
};

export const SORTABLE = Object.keys(VALUE);

export function sortProjectRows(rows, sort) {
  const get = sort && VALUE[sort.k];
  if (!get) return rows;
  return rows.slice().sort((a, b) => {
    const x = get(a);
    const y = get(b);
    if (x == null || y == null) return (x == null) - (y == null);
    return (x < y ? -1 : x > y ? 1 : 0) * sort.d;
  });
}

/** Header click: same column flips direction, a new column starts ascending (dates: soonest first). */
export const nextSort = (sort, k) => (sort && sort.k === k ? (sort.d > 0 ? { k, d: -1 } : null) : { k, d: 1 });
