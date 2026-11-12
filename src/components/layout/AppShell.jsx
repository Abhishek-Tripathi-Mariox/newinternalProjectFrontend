import { useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore, registerNavigate } from '@/store';
import { canAccessPath } from '@/domain/permissions';
import Sidebar from './Sidebar';
import Header from './Header';
import BreakBanner from './BreakBanner';
import PreviewBanner from './PreviewBanner';
import SecretNote from './SecretNote';
import NoAccess from './NoAccess';
import LazyBoundary from './LazyBoundary';
import { pageOf } from './routes';
import s from './AppShell.module.css';

/**
 * Signed-in layout: sidebar + sticky header + banners + routed page.
 * - Registers React Router's navigate with the store so actions (setViewAs, login, logout,
 *   submitEndShift, fixAccess) can change routes; the store redirects to the first allowed page.
 * - Any other forbidden page renders the NoAccess panel (Live/Attendance/Reports are
 *   blocked while previewing).
 */
export default function AppShell() {
  const { pathname } = useLocation();
  const perm = useStore(
    useShallow((x) => ({ viewAs: x.viewAs, users: x.users, roles: x.roles, tab: x.pj?.tab })),
  );
  const navigate = useNavigate();
  const allowed = canAccessPath(perm, pathname, perm.tab);
  const page = pageOf(pathname);

  useEffect(() => registerNavigate(navigate), [navigate]);

  useEffect(() => {
    document.title = `${page.title} · Mariox Portal`;
  }, [page.title]);

  return (
    <div className={s.shell}>
      <a href="#main-content" className={s.skip}>Skip to content</a>
      <Sidebar />
      <main className={s.main}>
        <Header />
        <BreakBanner />
        <PreviewBanner />
        <SecretNote />
        <div id="main-content" className={s.content} tabIndex={-1}>
          {allowed ? (
            <LazyBoundary resetKey={pathname} fallback={<div className={s.loading} role="status">Loading…</div>}>
              <Outlet />
            </LazyBoundary>
          ) : (
            <NoAccess />
          )}
        </div>
      </main>
    </div>
  );
}
