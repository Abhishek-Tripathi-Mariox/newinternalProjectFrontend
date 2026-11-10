import { Select } from './Select';
import { cx } from './cx';
import { PAGE_SIZES } from './usePagination';
import s from './Pagination.module.css';

/** Page numbers with ellipses: 1 … 4 5 [6] 7 8 … 20 */
function pageList(page, count) {
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  const out = [1];
  const from = Math.max(2, page - 1);
  const to = Math.min(count - 1, page + 1);
  if (from > 2) out.push('…');
  for (let i = from; i <= to; i++) out.push(i);
  if (to < count - 1) out.push('…');
  out.push(count);
  return out;
}

/**
 * Pagination bar: "Rows per page [10▾] · Showing 1–10 of 164 · ‹ 1 2 3 … 17 ›".
 * Pass the object returned by `usePagination` as props (`{...pager}`), or the fields directly.
 * `bordered` draws a top border (use when placed under a table inside a card).
 */
export function Pagination({ page, pageSize, total, pageCount, setPage, setPageSize, pageSizes = PAGE_SIZES, label = 'rows', bordered = true, className }) {
  if (!total) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  const go = (n) => setPage(Math.max(1, Math.min(pageCount, n)));
  return (
    <nav className={cx(s.bar, bordered && s.bordered, className)} aria-label="Pagination">
      <label className={s.size}>
        Rows per page
        <Select unstyled className={s.select} value={pageSize} options={pageSizes} searchable={false} onChange={(e) => setPageSize(+e.target.value)} />
      </label>
      <span className={s.info}>
        Showing <b>{from}–{to}</b> of <b>{total}</b> {label}
      </span>
      <div className={s.pages}>
        <button type="button" className={s.btn} onClick={() => go(page - 1)} disabled={page <= 1} aria-label="Previous page">‹ Prev</button>
        {pageList(page, pageCount).map((n, i) =>
          n === '…' ? (
            <span key={`e${i}`} className={s.gap} aria-hidden="true">…</span>
          ) : (
            <button
              key={n}
              type="button"
              className={cx(s.btn, s.num, n === page && s.on)}
              onClick={() => go(n)}
              aria-label={`Page ${n}`}
              aria-current={n === page ? 'page' : undefined}
            >
              {n}
            </button>
          ),
        )}
        <button type="button" className={s.btn} onClick={() => go(page + 1)} disabled={page >= pageCount} aria-label="Next page">Next ›</button>
      </div>
    </nav>
  );
}
