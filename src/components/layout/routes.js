/** Route table shared by the router, sidebar and header. */
export const PAGES = {
  '/live': { title: 'Live now', crumb: 'CEO Portal' },
  '/attendance': { title: 'Attendance', crumb: 'CEO Portal' },
  '/reports': { title: 'Reports', crumb: 'CEO Portal' },
  '/dashboard': { title: 'Dashboard', crumb: 'CEO Portal' },
  '/leads': { title: 'Leads', crumb: 'Sales' },
  '/follow-ups': { title: 'Follow-ups', crumb: 'Sales' },
  '/lead-setup': { title: 'Lead setup', crumb: 'Sales' },
  '/projects': { title: 'Projects', crumb: 'Delivery' },
  '/users': { title: 'Users & roles', crumb: 'Admin' },
};

export const DEFAULT_PATH = '/live';

/** Projects sub-tabs that light up "Team & hours" in the sidebar instead of "Projects". */
export const TEAM_TABS = ['team', 'cap', 'ts'];

export const pageOf = (pathname) => {
  const key = Object.keys(PAGES).find((p) => pathname === p || pathname.startsWith(`${p}/`));
  return key ? { path: key, ...PAGES[key] } : { path: DEFAULT_PATH, ...PAGES[DEFAULT_PATH] };
};
