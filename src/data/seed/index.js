import { OWNERS } from '@/config/constants';
import { today } from '@/lib/date';
import { useSettings } from '@/store/settings';
import { seedSales } from './sales';
import { seedProjects } from './projects';
import { seedTasks } from './tasks';
import { seedBugs } from './bugs';
import { seedCrs, healCrMs, backfillCr1011 } from './changeRequests';
import { seedUsers } from './users';
import { seedAttendance } from './attendance';
import { seedLive, backfillTodayAttendance } from './live';

/** localStorage keys — identical to the prototype so existing data carries over. */
export const STORAGE_KEYS = {
  sales: 'mariox-ceo-portal-v1',
  projects: 'mariox-ceo-projects-v1',
  users: 'mariox-ceo-users-v1',
  live: 'mariox-ceo-live-v1',
  auth: 'mariox-ceo-auth-v1',
  att: 'mariox-ceo-att-v1',
  reports: 'mariox-ceo-rep-v1',
};

/** JSON.parse(localStorage[key]) or null on any failure. */
function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key));
  } catch {
    return null;
  }
}

const isVerify = (x) => /^VERIFY/i.test(x.title || '');

/** Default project-filter bar. */
export const PJ_FILTER_DEFAULT = { q: '', date: 'week', from: '', to: '', status: '', team: '', member: '', project: '' };

/** Initial UI (non-persisted) state. */
export function initialUiState() {
  return {
    toast: '',
    modal: null,
    alerts: [],
    selLead: null,
    selIds: [],
    lf: { q: '', date: 'all', from: '', to: '', owner: '', source: '', service: '', status: '', flag: '' },
    sort: { k: 'created', d: -1 },
    leadView: useSettings.getState().defaultLeadsView === 'Table' ? 'table' : 'kanban',
    staleDays: 7,
    ff: { q: '', type: '', owner: '', priority: '', meet: '', date: 'all', from: '', to: '' },
    fuTab: 'today',
    pj: {
      tab: 'overview', pView: 'board', tsView: 'entries', msSt: '', msView: 'stage', tView: 'board', tF: '', bView: 'board', bQ: 'open', bf: {},
      bAllTime: true, capW: 1, capF: '', crSt: '', selP: null, selM: null, mDay: null, pDay: null, exp: null, exp2: null, portal: null,
      cNote: {}, cSig: {}, cAgree: {}, linkDraft: null, dragP: null, overS: null, f: { ...PJ_FILTER_DEFAULT },
    },
    liveF: 'all',
    attF: null,
    repF: null,
    us: { tab: 'users', q: '', role: '', dept: '', status: '', selRole: 'r-pm' },
  };
}

/**
 * Build the full initial store state: load every persisted slice or seed it,
 * then apply the prototype's migrations / healing (initState + componentDidMount):
 *  - drop VERIFY-titled bugs and CRs (test leftovers)
 *  - heal missing CR milestones
 *  - backfill CR-101-1's work breakdown, tasks and logs
 *  - drop a stored live board that is not from today; seed one if missing
 *  - backfill today's attendance events from the live board
 *  - validate the stored session; non-super users start previewing as themselves
 */
export function buildInitialState() {
  // Sales
  let d = load(STORAGE_KEYS.sales);
  if (!d || !d.leads) d = seedSales();

  // Delivery
  let pd = load(STORAGE_KEYS.projects);
  if (!pd || !pd.projects) pd = seedProjects();
  if (!pd.tasks) pd.tasks = seedTasks(pd.projects, pd.milestones, pd.members);
  if (!pd.bugs) pd.bugs = seedBugs(pd.projects, pd.milestones, pd.members);
  pd.bugs = pd.bugs.filter((b) => !isVerify(b));
  if (!pd.crs) pd.crs = seedCrs(pd);
  pd.crs = pd.crs.filter((c) => !isVerify(c));
  pd.milestones = healCrMs(pd.crs, pd.milestones, pd.projects);
  backfillCr1011(pd);

  // People
  let ud = load(STORAGE_KEYS.users);
  if (!ud || !ud.users) ud = seedUsers(pd.members, OWNERS);

  // Live board (only valid for today)
  let live = load(STORAGE_KEYS.live);
  if (!live || live.date !== today()) live = null;

  // Session + attendance
  let auth = load(STORAGE_KEYS.auth);
  let attLog = load(STORAGE_KEYS.att);
  if (!Array.isArray(attLog)) attLog = seedAttendance(pd.members);
  const au = auth && (ud.users || []).find((x) => x.id === auth.uid);
  if (!au) auth = null;

  const data = {
    leads: d.leads,
    fus: d.fus || [],
    members: pd.members,
    projects: pd.projects,
    milestones: pd.milestones,
    logs: pd.logs,
    tasks: pd.tasks,
    bugs: pd.bugs,
    crs: pd.crs,
    users: ud.users,
    roles: ud.roles,
    audit: ud.audit || [],
  };

  // componentDidMount: seed today's live board from the (full) data, then
  // backfill today's attendance events from it.
  if (!live) live = seedLive(data);
  attLog = backfillTodayAttendance(live, attLog) || attLog;

  const reports = load(STORAGE_KEYS.reports);

  return {
    ...data,
    auth,
    attLog,
    live,
    reports: Array.isArray(reports) ? reports : [],
    viewAs: au && au.role !== 'r-super' ? au.id : null,
    ...initialUiState(),
  };
}
