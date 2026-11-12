import { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { firstAllowedPath } from '@/domain/permissions';
import { useStore } from '@/store';
import { useSettings } from '@/store/settings';
import AppShell from '@/components/layout/AppShell';
import ModalHost from '@/components/layout/ModalHost';
import DrawerHost from '@/components/layout/DrawerHost';
import NotificationStack from '@/components/layout/NotificationStack';
import { DEFAULT_PATH } from '@/components/layout/routes';
import AccountSetupScreen from '@/features/auth/AccountSetupScreen';
import LoginScreen from '@/features/auth/LoginScreen';

const LivePage = lazy(() => import('@/features/live/LivePage'));
const AttendancePage = lazy(() => import('@/features/attendance/AttendancePage'));
const ReportsPage = lazy(() => import('@/features/reports/ReportsPage'));
const DashboardPage = lazy(() => import('@/features/dashboard/DashboardPage'));
const LeadsPage = lazy(() => import('@/features/leads/LeadsPage'));
const FollowUpsPage = lazy(() => import('@/features/followups/FollowUpsPage'));
const LeadSetupPage = lazy(() => import('@/features/setup/LeadSetupPage'));
const ProjectsPage = lazy(() => import('@/features/projects/ProjectsPage'));
const UsersPage = lazy(() => import('@/features/users/UsersPage'));

/**
 * While signed in: follow-up reminders (1.2 s after sign-in, then every 15 s) and a light live
 * refresh (`pollLive`, every 20 s) so Live now / attendance reflect other people's actions.
 */
function useReminderPolling(active) {
  const checkReminders = useStore((x) => x.checkReminders);
  const pollLive = useStore((x) => x.pollLive);
  useEffect(() => {
    if (!active) return undefined;
    const live = setInterval(() => { if (pollLive) pollLive(); }, 20000);
    const run = () => {
      if (useSettings.getState().reminderAlerts === false) return;
      checkReminders();
    };
    const t = setTimeout(run, 1200);
    const iv = setInterval(run, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
      clearInterval(live);
    };
  }, [active, checkReminders, pollLive]);
}

/** Signed-out pages: set-password links from admins, otherwise sign-in. */
function PublicRoutes() {
  return (
    <Routes>
      <Route path="accept-invite" element={<AccountSetupScreen mode="accept-invite" />} />
      <Route path="reset-password" element={<AccountSetupScreen mode="reset-password" />} />
      <Route path="*" element={<LoginScreen />} />
    </Routes>
  );
}

/** Full-screen splash while the session is restored / data loads, or an error with retry. */
function BootScreen({ error }) {
  const bootstrap = useStore((x) => x.bootstrap);
  const endSession = useStore((x) => x.endSession);
  return (
    <div className="boot" role={error ? 'alert' : 'status'} aria-live="polite">
      <div className="boot-mark" aria-hidden="true">M</div>
      {error ? (
        <>
          <div className="boot-title">Couldn’t load the portal</div>
          <div className="boot-sub">{error}</div>
          <div className="boot-actions">
            <button type="button" className="boot-btn" onClick={() => { useStore.setState({ boot: 'pending' }); bootstrap().catch((e) => useStore.setState({ boot: 'error', bootError: e.message })); }}>Try again</button>
            <button type="button" className="boot-link" onClick={() => endSession()}>Sign out</button>
          </div>
        </>
      ) : (
        <div className="boot-sub">Loading your portal…</div>
      )}
    </div>
  );
}

export default function App() {
  const boot = useStore((x) => x.boot);
  const bootError = useStore((x) => x.bootError);
  const restoreSession = useStore((x) => x.restoreSession);
  // Restore a signed-in session from the refresh cookie once on page load.
  useEffect(() => { restoreSession(); }, [restoreSession]);
  const signedIn = useStore((x) => !!x.auth) && boot === 'ready';
  // Where "/" and unknown URLs go: the first page this person may open. Using it (not a fixed
  // /live) also wins the race when the router renders before the login navigation lands.
  const landing = useStore((x) => (x.auth ? firstAllowedPath(x) : DEFAULT_PATH));
  useReminderPolling(signedIn);

  return (
    <BrowserRouter>
      {boot !== 'ready' ? (
        <BootScreen error={boot === 'error' ? bootError : ''} />
      ) : signedIn ? (
        <>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to={landing} replace />} />
              <Route path="live" element={<LivePage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="follow-ups" element={<FollowUpsPage />} />
              <Route path="lead-setup" element={<LeadSetupPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="*" element={<Navigate to={landing} replace />} />
            </Route>
          </Routes>
          <DrawerHost />
          <ModalHost />
        </>
      ) : (
        <PublicRoutes />
      )}
      <NotificationStack />
    </BrowserRouter>
  );
}
