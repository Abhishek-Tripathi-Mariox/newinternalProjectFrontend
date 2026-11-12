import { useSettings } from '@/store/settings';

/**
 * Empty data + default UI state. All data is loaded from the API after sign-in
 * (see store/slices/session.js → bootstrap); nothing is generated or stored in the browser.
 */
export const PJ_FILTER_DEFAULT = { q: '', date: 'week', from: '', to: '', status: '', team: '', member: '', project: '' };

export function emptyData() {
  return {
    leads: [], fus: [], owners: [],
    members: [], projects: [], milestones: [], logs: [], tasks: [], bugs: [], crs: [],
    users: [], roles: [], audit: [],
    live: null, attLog: [], reports: [],
  };
}

export function initialUiState() {
  return {
    toast: '',
    modal: null,
    alerts: [],
    selLead: null,
    selIds: [],
    viewAs: null,
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
