import { getOwners } from '@/store/owners';

/** Replace the item with `id` by fn(item); other items keep their identity. */
export const mapById = (arr, id, fn) => arr.map((x) => (x.id === id ? fn(x) : x));

/** Shallow-merge `patch` into the item with `id`. */
export const patchById = (arr, id, patch) => mapById(arr, id, (x) => ({ ...x, ...patch }));

/** Sales owner display name ('Unassigned' if unknown). */
export const ownerName = (id) => (getOwners().find((o) => o.id === id) || { name: 'Unassigned' }).name;

/** Member name or undefined. */
export const memberName = (members, id) => (members.find((x) => x.id === id) || {}).name;

