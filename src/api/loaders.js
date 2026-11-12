import { ApiError } from './client';
import { loadSales } from './sales';
import { loadDelivery } from './delivery';
import { loadPeople } from './people';
import { loadWorkday } from './workday';
import { loadMasters } from './masters';

/**
 * Bootstrap data after sign-in. Each domain loader returns a partial store state; loaders run in
 * parallel. A 403 (role can't see that module) yields empty data instead of failing the boot.
 * Loaders receive the signed-in principal (`me`) so they can skip modules the role can't open.
 */
const LOADERS = [['sales', loadSales], ['delivery', loadDelivery], ['people', loadPeople], ['workday', loadWorkday], ['masters', loadMasters]];

export async function loadAll(me) {
  const parts = await Promise.all(LOADERS.map(async ([name, fn]) => {
    try {
      return await fn(me);
    } catch (e) {
      if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return {};
      e.message = `Couldn't load ${name} data: ${e.message}`;
      throw e;
    }
  }));
  return Object.assign({}, ...parts);
}

/** Reload one or more domains (after a write that changes derived server data). */
export async function reload(me, names) {
  const pick = LOADERS.filter(([n]) => names.includes(n));
  const parts = await Promise.all(pick.map(([, fn]) => fn(me).catch(() => ({}))));
  return Object.assign({}, ...parts);
}
