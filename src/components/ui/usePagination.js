import { useEffect, useMemo, useState } from 'react';

export const PAGE_SIZES = [10, 25, 50, 100];
export const DEFAULT_PAGE_SIZE = 10;

/**
 * Client-side pagination state for a list.
 *
 * - Resets to page 1 whenever `resetKey` changes (pass filters / sort) or the total changes.
 * - Clamps the page if the list shrinks (e.g. after a delete).
 *
 * @param {any[]} items  full (already filtered + sorted) list
 * @param {{pageSize?: number, resetKey?: any}} [opts]
 * @returns {{pageItems:any[], page:number, pageSize:number, total:number, pageCount:number,
 *            start:number, setPage:(n:number)=>void, setPageSize:(n:number)=>void}}
 */
export function usePagination(items = [], { pageSize: initialSize = DEFAULT_PAGE_SIZE, resetKey } = {}) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeState] = useState(initialSize);
  const total = items.length;
  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  // New filters / sort / data size → back to the first page.
  useEffect(() => { setPage(1); }, [resetKey, total]);

  const current = Math.min(page, pageCount);
  const start = (current - 1) * pageSize;
  const pageItems = useMemo(() => items.slice(start, start + pageSize), [items, start, pageSize]);

  const setPageSize = (n) => {
    // Keep the first visible row on screen when the page size changes.
    setPageSizeState(n);
    setPage(Math.floor(start / n) + 1);
  };

  return { pageItems, page: current, pageSize, total, pageCount, start, setPage, setPageSize };
}
