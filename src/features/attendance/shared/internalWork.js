/**
 * Internal (non-project) work from end-of-shift reports, flattened to entries:
 * `{id, who, d, cat, h, note}`. Filter by person and/or day range [from, to).
 */
export function internalEntries(reports, { who, from, to } = {}) {
  const out = [];
  (reports || []).forEach((r) => {
    if (who && r.who !== who) return;
    if (from != null && r.d < from) return;
    if (to != null && r.d >= to) return;
    (r.internal || []).forEach((x, i) => out.push({ id: `${r.id}-${i}`, who: r.who, d: r.d, cat: x.cat || 'Other', h: +x.h || 0, note: x.note || '' }));
  });
  return out.sort((a, b) => b.d - a.d);
}

/** One person's internal work on one day (`d` = start-of-day timestamp). */
export const internalOn = (reports, who, d) => internalEntries(reports, { who, from: d, to: d + 1 });

export const sumH = (list) => list.reduce((x, e) => x + e.h, 0);
