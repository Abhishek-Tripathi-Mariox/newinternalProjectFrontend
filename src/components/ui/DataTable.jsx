import { cx } from './cx';
import { Pagination } from './Pagination';
import { DEFAULT_PAGE_SIZE, usePagination } from './usePagination';
import s from './DataTable.module.css';

/**
 * Bordered table card with built-in pagination.
 * columns: [{key, label, align, width, sortable, render(row, i), thStyle, tdStyle}]
 * sort {k, d} + onSort(key) give clickable headers with ↑/↓. onRowClick(row) makes rows clickable.
 * rowStyle(row) for per-row background/opacity. `minWidth` forces horizontal scroll on small screens.
 * `empty` text shows when rows is empty. `footer` renders after the table inside the card.
 *
 * Pagination (on by default): `pageSize` (default 10) sets the initial rows per page; the viewer can
 * change it (10/25/50/100). The page resets to 1 when the rows, sort or `resetKey` change.
 * `itemLabel` names the rows in "Showing 1–10 of 42 leads". Pass `pagination={false}` to show all rows.
 * `render(row, i)` receives the row's index in the full list, not the page.
 */
export function DataTable({
  columns = [], rows = [], rowKey = (r) => r.id, onRowClick, sort, onSort, empty, rowStyle, minWidth, footer, className, style, caption,
  pagination = true, pageSize = DEFAULT_PAGE_SIZE, resetKey, itemLabel = 'rows',
}) {
  const keyOf = typeof rowKey === 'function' ? rowKey : (r) => r[rowKey];
  const pager = usePagination(rows, { pageSize, resetKey: [resetKey, sort && sort.k, sort && sort.d].join('|') });
  const visible = pagination ? pager.pageItems : rows;
  const offset = pagination ? pager.start : 0;

  return (
    <div className={cx(s.wrap, className)} style={style}>
      <div className={s.scroll}>
        <table className={s.table} style={minWidth ? { minWidth } : undefined}>
          {caption && <caption className="sr-only">{caption}</caption>}
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort && sort.k === c.key;
                const ariaSort = active ? (sort.d > 0 ? 'ascending' : 'descending') : undefined;
                return (
                  <th key={c.key} className={s.th} style={{ textAlign: c.align || 'left', width: c.width, ...c.thStyle }} aria-sort={ariaSort} scope="col">
                    {c.sortable && onSort ? (
                      <button type="button" className={s.sortBtn} onClick={() => onSort(c.key)}>
                        {c.label}
                        <span className={s.arrow} aria-hidden="true">{active ? (sort.d > 0 ? '↑' : '↓') : ''}</span>
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row, j) => {
              const i = offset + j;
              return (
                <tr
                  key={keyOf(row, i)}
                  className={cx(s.tr, onRowClick && s.click)}
                  style={rowStyle ? rowStyle(row) : undefined}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.target === e.currentTarget && e.key === 'Enter') onRowClick(row);
                        }
                      : undefined
                  }
                >
                  {columns.map((c) => (
                    <td key={c.key} className={s.td} style={{ textAlign: c.align || 'left', ...c.tdStyle }}>
                      {c.render ? c.render(row, i) : row[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {!rows.length && empty && <div className={s.empty}>{empty}</div>}
      {pagination && <Pagination {...pager} label={itemLabel} />}
      {footer}
    </div>
  );
}
