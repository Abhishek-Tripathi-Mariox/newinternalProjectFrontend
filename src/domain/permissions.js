/**
 * Role-based access: who is being viewed as, what they can do, and the
 * role-scoped view of the data. Pure functions over the store state.
 */

/** Projects sub-tab → permission module. */
export const MODULE_OF_TAB = { overview: 'projects', projects: 'projects', milestones: 'projects', tasks: 'tasks', bugs: 'bugs', team: 'team', cap: 'team', cr: 'projects', ts: 'ts' };

/** Route path → permission module (null = CEO-only page, hidden while previewing). */
export const MODULE_OF_PATH = { '/live': null, '/attendance': null, '/reports': null, '/dashboard': 'dash', '/leads': 'leads', '/follow-ups': 'fu', '/lead-setup': 'leads', '/projects': 'projects', '/project-follow-ups': 'projects', '/users': 'users' };

/** Person id used by live/attendance/logs: member id, sales owner id, or the bare user id. */
export const pidOf = (u) => (u ? u.memberId || u.ownerId || u.id.replace(/^u-/, '') : null);

const findUser = (state, id) => (state.users || []).find((x) => x.id === id) || null;

/** The user currently being viewed as (preview, or a non-super user's own session), or null. */
export const viewUser = (state) => (state.viewAs ? findUser(state, state.viewAs) : null);

/** The logged-in user (no preview applied), or null. */
export const authUser = (state) => (state.auth ? findUser(state, state.auth.uid) : null);

/**
 * Effective session user: the logged-in user, or — when a Super Admin previews
 * someone who is not a Super Admin — the previewed user. (Original myBreak / sess.)
 */
export function sessionUser(state) {
  const u0 = authUser(state);
  const uv = u0 && u0.role === 'r-super' && state.viewAs ? findUser(state, state.viewAs) : null;
  return uv && uv.role !== 'r-super' ? uv : u0;
}

/** Does the viewed-as user's role allow `act` ('v'|'c'|'e'|'d') on `mod`? Always true when not previewing. */
export function can(state, mod, act = 'v') {
  if (!state.viewAs || !mod) return true;
  const u = findUser(state, state.viewAs);
  const r = u && (state.roles || []).find((x) => x.id === u.role);
  const p = r && r.perms && r.perms[mod];
  return !!(p && p[act || 'v']);
}

/** Can the viewed-as user manage this project as its PM? */
export function isPMof(state, p) {
  if (!state.viewAs) return true;
  const u = findUser(state, state.viewAs);
  if (!u) return false;
  if (u.role === 'r-super') return true;
  return u.role === 'r-pm' && !!p && (u.memberId === p.pm || u.id === `u-${p.pm}`);
}

/**
 * Role-scoped copy of the state: filters leads, follow-ups, projects,
 * milestones, CRs, tasks, bugs and logs to what the viewed-as role may see.
 * Returns the same state object when nothing is hidden.
 */
export function scopeState(S) {
  if (!S.viewAs) return S;
  const u = findUser(S, S.viewAs);
  const r = u && (S.roles || []).find((x) => x.id === u.role);
  if (!u || !r) return S;

  const sc = (k) => {
    const p = r.perms && r.perms[k];
    return p && p.v ? p.scope || 'all' : 'all';
  };
  const pid = pidOf(u);
  const cli = u.role === 'r-client';
  const me = (S.members || []).find((m) => m.id === pid);
  const tIds = new Set([pid].concat(me ? S.members.filter((m) => m.team === me.team).map((m) => m.id) : []));
  const who = (k, id) => (sc(k) === 'own' ? id === pid : sc(k) === 'team' ? tIds.has(id) : true);

  const out = { ...S };
  let any = false;
  const lim = (k, fn) => {
    const a = S[k] || [];
    const v = a.filter(fn);
    if (v.length === a.length) return;
    any = true;
    out[k] = v;
  };
  lim('leads', (l) => who('leads', l.owner));
  lim('fus', (x) => who('fu', x.owner));
  const ps = sc('projects');
  lim('projects', (p) => (cli
    ? (u.clientOf || []).includes(p.id)
    : ps === 'all' ? true
      : ps === 'own' ? p.pm === pid || (p.team || []).includes(pid)
        : (p.pm && tIds.has(p.pm)) || (p.team || []).some((m) => tIds.has(m))));
  const vp = new Set((out.projects || []).map((p) => p.id));
  const byP = (x) => vp.has(x.p);
  lim('milestones', byP);
  lim('crs', byP);
  lim('pfus', (x) => !cli && byP(x));
  lim('tasks', (t) => byP(t) && who('tasks', t.a));
  lim('bugs', (b) => byP(b) && (cli || sc('bugs') === 'all' || who('bugs', b.a) || b.rep === pid));
  lim('logs', (l) => byP(l) && who('ts', l.m));
  return any ? out : S;
}

/** May the current view open this route? (Original noAccess logic.) `tab` = pj.tab for /projects. */
export function canAccessPath(state, path, tab = state.pj && state.pj.tab) {
  const key = Object.keys(MODULE_OF_PATH).find((p) => path === p || path.startsWith(`${p}/`));
  if (!key) return true;
  const mod = key === '/projects' ? MODULE_OF_TAB[tab] || 'projects' : MODULE_OF_PATH[key];
  if (mod === null) return !state.viewAs;
  // Managing pipeline stages / sources / services needs edit rights on leads.
  if (key === '/lead-setup') return can(state, 'leads', 'e');
  return can(state, mod, 'v');
}

/**
 * First page the viewed-as user may open (original setViewAs fallback order).
 * @returns {{path:string, tab?:string}|null}
 */
export function firstAllowedTarget(state) {
  const order = [['/dashboard', 'dash'], ['/leads', 'leads'], ['/follow-ups', 'fu']]
    .concat(['overview', 'tasks', 'bugs', 'ts', 'team'].map((t) => [`/projects:${t}`, MODULE_OF_TAB[t]]), [['/users', 'users']]);
  const hit = order.find(([, m]) => can(state, m, 'v'));
  if (!hit) return null;
  const [path, tab] = hit[0].split(':');
  return tab ? { path, tab } : { path };
}

/** Path string of firstAllowedTarget ('/live' when not previewing). */
export function firstAllowedPath(state) {
  if (!state.viewAs) return '/live';
  const t = firstAllowedTarget(state);
  return t ? t.path : '/live';
}

/** First Projects sub-tab the viewer can open (original goProj). */
export const firstProjectsTab = (state) => ['overview', 'tasks', 'bugs', 'ts'].find((x) => can(state, MODULE_OF_TAB[x])) || 'overview';
