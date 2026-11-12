import { create } from 'zustand';
import { useStore } from '@/store';
import { mastersApi, fromApiItem, fromApiStage } from '@/api/masters';

/**
 * Editable master lists (lead pipeline stages, lead sources, services), loaded from the API
 * (`/lead-stages`, `/lead-sources`, `/services`) by api/masters.loadMasters after sign-in.
 * Shape: `{ leadStatuses: [[name, hue]], sources: string[], services: string[] }`.
 *
 * - `addX(raw)` is a quick action: it returns the canonical name synchronously (inline "+ Add"
 *   in dropdowns needs it), adds it right away and saves it to the server; a server rejection
 *   rolls it back and flashes the message.
 * - `createMaster(kind, raw, hue?)` / `renameX` are form actions: async, resolve to an error
 *   message or undefined.
 * - remove / move / setStageHue update immediately and roll back if the server refuses.
 */

/** Stages that the app logic depends on — never removable / renameable. */
export const CORE_STAGES = ['New', 'Won', 'Lost'];

const clean = (x) => String(x ?? '').trim().replace(/\s+/g, ' ');
const cleanService = (x) => clean(x).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
const findCI = (list, name) => list.find((x) => x.toLowerCase() === name.toLowerCase());
const flash = (msg) => useStore.getState().flash?.(msg);

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

const inUseMsg = (what, name, n, noun = 'lead') => `Can't remove ${what} “${name}” — ${n} ${noun}${n === 1 ? '' : 's'} use${n === 1 ? 's' : ''} it`;

/** Per-kind config: store key, wording, name cleaning. */
const K = {
  stage: { key: 'leadStatuses', what: 'stage', Label: 'Stage', clean },
  source: { key: 'sources', what: 'source', Label: 'Source', clean },
  service: { key: 'services', what: 'service', Label: 'Service', clean: cleanService },
};
const namesOf = (st, kind) => (kind === 'stage' ? st.leadStatuses.map((s) => s[0]) : st[K[kind].key]);

/** Replace a whole list from a server list response. */
const fromList = (kind, rows) => ({ [K[kind].key]: (rows || []).map(kind === 'stage' ? fromApiStage : fromApiItem) });

/** Rename a value in the loaded leads / projects (the server already did the same). */
function renameInData(kind, from, to) {
  if (kind === 'stage') {
    useStore.setState((st) => ({ leads: st.leads.map((l) => (l.status === from ? { ...l, status: to } : l)) }));
  } else if (kind === 'source') {
    useStore.setState((st) => ({ leads: st.leads.map((l) => (l.source === from ? { ...l, source: to } : l)) }));
  } else {
    const swap = (o) => {
      const list = leadServices(o);
      return list.includes(from) ? { ...o, service: list.map((x) => (x === from ? to : x)).join(', ') } : o;
    };
    useStore.setState((st) => ({ leads: st.leads.map(swap), projects: (st.projects || []).map(swap) }));
  }
}

export const useMasters = create((set, get) => {
  /** Quick add: returns the canonical name now, saves in the background. */
  const quickAdd = (kind, raw) => {
    const k = K[kind];
    const name = k.clean(raw);
    if (!name) return undefined;
    const ex = findCI(namesOf(get(), kind), name);
    if (ex) return ex;
    const prev = get()[k.key];
    if (kind === 'stage') {
      const at = prev.findIndex((s) => s[0] === 'Won');
      const next = prev.slice();
      next.splice(at < 0 ? next.length : at, 0, [name, 265]);
      set({ leadStatuses: next });
      flash(`Stage “${name}” added before Won`);
    } else {
      set({ [k.key]: prev.concat(name) });
      flash(`${k.Label} “${name}” added`);
    }
    mastersApi.add(kind, name)
      .then((item) => {
        if (kind === 'stage' && item) set({ leadStatuses: get().leadStatuses.map((s) => (s[0] === name ? [item.name, item.hue] : s)) });
      })
      .catch((e) => {
        set({ [k.key]: get()[k.key].filter((x) => (kind === 'stage' ? x[0] : x) !== name) });
        flash(e.message);
      });
    return name;
  };

  /** Remove: refuse locally when obviously in use, else remove now and roll back on failure. */
  const remove = async (kind, name) => {
    const k = K[kind];
    if (kind === 'stage' && CORE_STAGES.includes(name)) { flash(`“${name}” is a core stage and can't be removed`); return false; }
    const n = usage(kind === 'stage' ? 'status' : kind, name);
    if (n) { flash(inUseMsg(k.what, name, n, kind === 'service' ? 'lead / project' : 'lead')); return false; }
    if (kind !== 'stage' && get()[k.key].length <= 1) { flash(`Keep at least one ${k.what}`); return false; }
    const prev = get()[k.key];
    set({ [k.key]: prev.filter((x) => (kind === 'stage' ? x[0] : x) !== name) });
    try {
      await mastersApi.remove(kind, name);
      flash(`${k.Label} “${name}” removed`);
      return true;
    } catch (e) {
      set({ [k.key]: prev });
      flash(e.message);
      return false;
    }
  };

  /** Rename (form action): resolves to an error message or undefined. */
  const rename = async (kind, from, raw) => {
    const k = K[kind];
    const to = k.clean(raw);
    if (!to) return 'Enter a name.';
    if (kind === 'stage' && CORE_STAGES.includes(from)) return `“${from}” is a core stage and can't be renamed.`;
    if (to === from) return undefined;
    if (namesOf(get(), kind).some((x) => x !== from && x.toLowerCase() === to.toLowerCase())) return `A ${k.what} called “${to}” already exists.`;
    try {
      await mastersApi.rename(kind, from, to);
    } catch (e) {
      return e.message;
    }
    set({ [k.key]: get()[k.key].map((x) => (kind === 'stage' ? (x[0] === from ? [to, x[1]] : x) : (x === from ? to : x))) });
    renameInData(kind, from, to);
    flash(`${k.Label} renamed to “${to}”`);
    return undefined;
  };

  /** Move one step (-1 up / +1 down); the server returns the new order. */
  const move = async (kind, name, dir) => {
    const k = K[kind];
    const prev = get()[k.key];
    if (kind === 'stage') {
      if (CORE_STAGES.includes(name)) return;
      const cur = prev.slice();
      const i = cur.findIndex((s) => s[0] === name);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= cur.length || CORE_STAGES.includes(cur[j][0])) return;
      [cur[i], cur[j]] = [cur[j], cur[i]];
      set({ leadStatuses: cur });
    } else {
      set({ [k.key]: moveIn(prev, name, dir) });
    }
    try {
      const rows = await mastersApi.move(kind, name, dir);
      if (Array.isArray(rows)) set(fromList(kind, rows));
    } catch (e) {
      set({ [k.key]: prev });
      flash(e.message);
    }
  };

  return {
    leadStatuses: [],
    sources: [],
    services: [],

    addLeadStatus: (raw) => quickAdd('stage', raw),
    addSource: (raw) => quickAdd('source', raw),
    addService: (raw) => quickAdd('service', raw),

    /**
     * Add from a form (Lead setup): waits for the server. Resolves to an error message or undefined.
     * `hue` (stages) is applied after the add.
     */
    async createMaster(kind, raw, hue) {
      const k = K[kind];
      const name = k.clean(raw);
      if (!name) return `Enter a ${k.what} name.`;
      const ex = findCI(namesOf(get(), kind), name);
      if (ex) return `A ${k.what} called “${ex}” already exists.`;
      let item;
      try {
        item = await mastersApi.add(kind, name);
        if (kind === 'stage' && hue != null && item && item.hue !== hue) item = await mastersApi.setHue(item.name, hue);
        set(fromList(kind, await mastersApi.list(kind)));
      } catch (e) {
        return e.message;
      }
      flash(kind === 'stage' ? `Stage “${item.name}” added before Won` : `${k.Label} “${item.name}” added`);
      return undefined;
    },

    /** Removal resolves to true when removed. Refuses (with a flash) when in use or a core stage. */
    removeLeadStatus: (name) => remove('stage', name),
    removeSource: (name) => remove('source', name),
    removeService: (name) => remove('service', name),

    /** Rename a value; every lead (and project, for services) that uses it follows. */
    renameLeadStatus: (from, raw) => rename('stage', from, raw),
    renameSource: (from, raw) => rename('source', from, raw),
    renameService: (from, raw) => rename('service', from, raw),

    /** Change a stage's colour (hue 0–360). Resolves to an error message or undefined. */
    async setStageHue(name, hue) {
      const prev = get().leadStatuses;
      set({ leadStatuses: prev.map((s) => (s[0] === name ? [s[0], hue] : s)) });
      try {
        await mastersApi.setHue(name, hue);
        return undefined;
      } catch (e) {
        set({ leadStatuses: prev });
        return e.message;
      }
    },

    /**
     * Move a custom stage one step up (-1) or down (+1) in the pipeline.
     * "New" always stays first and Won / Lost always stay last.
     */
    moveLeadStatus: (name, dir) => move('stage', name, dir),
    /** Move a source / service one step up (-1) or down (+1) — controls dropdown order. */
    moveSource: (name, dir) => move('source', name, dir),
    moveService: (name, dir) => move('service', name, dir),
  };
});

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
const stageNamesOf = (ls) => {
  if (ls !== lastLs) { lastLs = ls; lastNames = ls.map((s) => s[0]); }
  return lastNames;
};
export const useLeadStatusNames = () => stageNamesOf(useMasters(selNames));
export const useSources = () => useMasters((st) => st.sources);
export const useServices = () => useMasters((st) => st.services);
