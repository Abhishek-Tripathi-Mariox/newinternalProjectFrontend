import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { LEAD_STATUSES, SERVICES, SOURCES } from '@/config/constants';
import { useStore } from '@/store';

/**
 * Editable master lists (lead pipeline stages, lead sources, services). Seeded from
 * config/constants (which stay as the defaults) and persisted under `mariox-portal-masters-v1`.
 * Shape: `{ leadStatuses: [[name, hue]], sources: string[], services: string[] }`.
 */

/** Stages that the app logic depends on — never removable / renameable. */
export const CORE_STAGES = ['New', 'Won', 'Lost'];

const clean = (x) => String(x ?? '').trim().replace(/\s+/g, ' ');
const findCI = (list, name) => list.find((x) => x.toLowerCase() === name.toLowerCase());
const flash = (msg) => useStore.getState().flash?.(msg);

/** Distance between two hues on the colour wheel. */
const hueDist = (a, b) => {
  const d = Math.abs(a - b) % 360;
  return Math.min(d, 360 - d);
};

/** A random hue as far as possible from the ones already in use (best of 24 tries). */
function distinctHue(used) {
  let best = Math.floor(Math.random() * 360);
  let bestD = -1;
  for (let i = 0; i < 24; i++) {
    const h = Math.floor(Math.random() * 360);
    const d = used.length ? Math.min(...used.map((u) => hueDist(u, h))) : 360;
    if (d > bestD) { best = h; bestD = d; }
  }
  return best;
}

const leadServices = (l) => (l.service || '').split(',').map((x) => x.trim()).filter(Boolean);

/** How many leads (and projects, for services) use a value. */
function usage(kind, name) {
  const { leads = [], projects = [] } = useStore.getState();
  if (kind === 'status') return leads.filter((l) => l.status === name).length;
  if (kind === 'source') return leads.filter((l) => l.source === name).length;
  return leads.filter((l) => leadServices(l).includes(name)).length + projects.filter((p) => leadServices(p).includes(name)).length;
}

const moveIn = (list, name, dir) => {
  const a = list.slice();
  const i = a.indexOf(name);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= a.length) return list;
  [a[i], a[j]] = [a[j], a[i]];
  return a;
};

const inUseMsg =(what, name, n, noun = 'lead') => `Can't remove ${what} “${name}” — ${n} ${noun}${n === 1 ? '' : 's'} use${n === 1 ? 's' : ''} it`;

export const useMasters = create(
  persist(
    (set, get) => ({
      leadStatuses: LEAD_STATUSES.map((s) => [s[0], s[1]]),
      sources: SOURCES.slice(),
      services: SERVICES.slice(),

      /** Adds a stage before 'Won'. Returns the canonical name (existing one if duplicate), or undefined if blank. */
      addLeadStatus: (raw) => {
        const name = clean(raw);
        if (!name) return undefined;
        const cur = get().leadStatuses;
        const ex = findCI(cur.map((s) => s[0]), name);
        if (ex) return ex;
        const hue = distinctHue(cur.map((s) => s[1]));
        const at = cur.findIndex((s) => s[0] === 'Won');
        const next = cur.slice();
        next.splice(at < 0 ? next.length : at, 0, [name, hue]);
        set({ leadStatuses: next });
        flash(`Stage “${name}” added before Won`);
        return name;
      },
      addSource: (raw) => {
        const name = clean(raw);
        if (!name) return undefined;
        const ex = findCI(get().sources, name);
        if (ex) return ex;
        set({ sources: get().sources.concat(name) });
        flash(`Source “${name}” added`);
        return name;
      },
      addService: (raw) => {
        const name = clean(raw).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        if (!name) return undefined;
        const ex = findCI(get().services, name);
        if (ex) return ex;
        set({ services: get().services.concat(name) });
        flash(`Service “${name}” added`);
        return name;
      },

      /** Removal returns true when removed. Refuses (with a flash) when in use or a core stage. */
      removeLeadStatus: (name) => {
        if (CORE_STAGES.includes(name)) { flash(`“${name}” is a core stage and can't be removed`); return false; }
        const n = usage('status', name);
        if (n) { flash(inUseMsg('stage', name, n)); return false; }
        set({ leadStatuses: get().leadStatuses.filter((s) => s[0] !== name) });
        flash(`Stage “${name}” removed`);
        return true;
      },
      removeSource: (name) => {
        const n = usage('source', name);
        if (n) { flash(inUseMsg('source', name, n)); return false; }
        if (get().sources.length <= 1) { flash('Keep at least one source'); return false; }
        set({ sources: get().sources.filter((x) => x !== name) });
        flash(`Source “${name}” removed`);
        return true;
      },
      removeService: (name) => {
        const n = usage('service', name);
        if (n) { flash(inUseMsg('service', name, n, 'lead / project')); return false; }
        if (get().services.length <= 1) { flash('Keep at least one service'); return false; }
        set({ services: get().services.filter((x) => x !== name) });
        flash(`Service “${name}” removed`);
        return true;
      },

      /**
       * Rename a value and update every lead (and project, for services) that uses it.
       * Returns an error message, or undefined on success. Core stages can't be renamed.
       */
      renameLeadStatus: (from, raw) => {
        const to = clean(raw);
        if (!to) return 'Enter a name.';
        if (CORE_STAGES.includes(from)) return `“${from}” is a core stage and can't be renamed.`;
        if (to === from) return undefined;
        const cur = get().leadStatuses;
        if (cur.some((s) => s[0] !== from && s[0].toLowerCase() === to.toLowerCase())) return `A stage called “${to}” already exists.`;
        set({ leadStatuses: cur.map((s) => (s[0] === from ? [to, s[1]] : s)) });
        useStore.setState((st) => ({ leads: st.leads.map((l) => (l.status === from ? { ...l, status: to } : l)) }));
        flash(`Stage renamed to “${to}”`);
        return undefined;
      },
      renameSource: (from, raw) => {
        const to = clean(raw);
        if (!to) return 'Enter a name.';
        if (to === from) return undefined;
        if (get().sources.some((x) => x !== from && x.toLowerCase() === to.toLowerCase())) return `A source called “${to}” already exists.`;
        set({ sources: get().sources.map((x) => (x === from ? to : x)) });
        useStore.setState((st) => ({ leads: st.leads.map((l) => (l.source === from ? { ...l, source: to } : l)) }));
        flash(`Source renamed to “${to}”`);
        return undefined;
      },
      renameService: (from, raw) => {
        const to = clean(raw).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
        if (!to) return 'Enter a name.';
        if (to === from) return undefined;
        if (get().services.some((x) => x !== from && x.toLowerCase() === to.toLowerCase())) return `A service called “${to}” already exists.`;
        const swap = (o) => {
          const list = leadServices(o);
          return list.includes(from) ? { ...o, service: list.map((x) => (x === from ? to : x)).join(', ') } : o;
        };
        set({ services: get().services.map((x) => (x === from ? to : x)) });
        useStore.setState((st) => ({ leads: st.leads.map(swap), projects: st.projects.map(swap) }));
        flash(`Service renamed to “${to}”`);
        return undefined;
      },

      /** Change a stage's colour (hue 0–360). */
      setStageHue: (name, hue) => set({ leadStatuses: get().leadStatuses.map((s) => (s[0] === name ? [s[0], hue] : s)) }),

      /**
       * Move a custom stage one step up (-1) or down (+1) in the pipeline.
       * "New" always stays first and Won / Lost always stay last.
       */
      moveLeadStatus: (name, dir) => {
        if (CORE_STAGES.includes(name)) return;
        const cur = get().leadStatuses.slice();
        const i = cur.findIndex((s) => s[0] === name);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= cur.length || CORE_STAGES.includes(cur[j][0])) return;
        [cur[i], cur[j]] = [cur[j], cur[i]];
        set({ leadStatuses: cur });
      },

      /** Move a source / service one step up (-1) or down (+1) — controls dropdown order. */
      moveSource: (name, dir) => set({ sources: moveIn(get().sources, name, dir) }),
      moveService: (name, dir) => set({ services: moveIn(get().services, name, dir) }),
    }),
    {
      name: 'mariox-portal-masters-v1',
      storage: createJSONStorage(() => localStorage),
      partialize: ({ leadStatuses, sources, services }) => ({ leadStatuses, sources, services }),
      // Heal a corrupt / partial stored value and make sure the core stages always exist.
      merge: (persisted, current) => {
        const p = persisted && typeof persisted === 'object' ? persisted : {};
        const strs = (a, def) => (Array.isArray(a) && a.every((x) => typeof x === 'string') && a.length ? a : def);
        let ls = Array.isArray(p.leadStatuses) && p.leadStatuses.every((s) => Array.isArray(s) && typeof s[0] === 'string' && typeof s[1] === 'number')
          ? p.leadStatuses : current.leadStatuses;
        for (const core of CORE_STAGES) {
          if (!ls.some((s) => s[0] === core)) {
            const def = LEAD_STATUSES.find((s) => s[0] === core);
            ls = core === 'New' ? [def, ...ls] : ls.concat([def]);
          }
        }
        return { ...current, leadStatuses: ls, sources: strs(p.sources, current.sources), services: strs(p.services, current.services) };
      },
    },
  ),
);

/* ---- non-hook getters (domain / store code) ---- */
export const getLeadStatuses = () => useMasters.getState().leadStatuses;
export const getLeadStatusNames = () => getLeadStatuses().map((s) => s[0]);
export const leadHue = (name) => (getLeadStatuses().find((s) => s[0] === name) || [name, 265])[1];
export const getSources = () => useMasters.getState().sources;
export const getServices = () => useMasters.getState().services;

/* ---- hooks ---- */
const selNames = (st) => st.leadStatuses;
export const useLeadStatuses = () => useMasters((st) => st.leadStatuses);
/** Stage names (memoised per leadStatuses array so the reference is stable). */
let lastLs = null;
let lastNames = [];
const namesOf = (ls) => {
  if (ls !== lastLs) { lastLs = ls; lastNames = ls.map((s) => s[0]); }
  return lastNames;
};
export const useLeadStatusNames = () => namesOf(useMasters(selNames));
export const useSources = () => useMasters((st) => st.sources);
export const useServices = () => useMasters((st) => st.services);
