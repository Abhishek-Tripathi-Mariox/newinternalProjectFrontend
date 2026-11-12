/**
 * Quick-action helper (INTEGRATION.md rule 4): update the store immediately, then call the API.
 *
 *   optimistic(set, get, applyFn, requestFn, { rollback, resync, quiet })
 *
 * - applyFn(state) → partial state (same as a Zustand updater). Applied right away.
 * - requestFn() → Promise (the API call). Its result is returned.
 * - On failure: `rollback(state, prev)` → partial state if given (prev = the values of the keys
 *   applyFn changed, captured before the change); else `resync` (array of domain names) →
 *   `get().resync(resync)`; else the changed keys are restored to their previous values.
 *   Then the server's message is flashed (unless `quiet`).
 * Resolves to the request's result, or `undefined` when it failed (never throws).
 */
export async function optimistic(set, get, applyFn, requestFn, { rollback, resync, quiet } = {}) {
  let prev = {};
  if (applyFn) {
    const before = get();
    const patch = applyFn(before) || {};
    prev = Object.fromEntries(Object.keys(patch).map((k) => [k, before[k]]));
    set(patch);
  }
  try {
    return await requestFn();
  } catch (e) {
    if (rollback) set((s) => rollback(s, prev) || {});
    else if (resync && resync.length) await get().resync(resync).catch(() => {});
    else if (Object.keys(prev).length) set(prev);
    if (!quiet) get().flash(e && e.message ? e.message : 'Something went wrong — try again');
    return undefined;
  }
}
