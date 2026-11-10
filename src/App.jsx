import { lazy, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { useStore } from '@/store';
import { useSettings } from '@/store/settings';
import AppShell from '@/components/layout/AppShell';
import ModalHost from '@/components/layout/ModalHost';
import DrawerHost from '@/components/layout/DrawerHost';
import NotificationStack from '@/components/layout/NotificationStack';
import { DEFAULT_PATH } from '@/components/layout/routes';
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

/** Follow-up reminders: first check 1.2 s after mount, then every 15 s (original componentDidMount). */
function useReminderPolling() {
  const checkReminders = useStore((x) => x.checkReminders);
  useEffect(() => {
    const run = () => {
      if (useSettings.getState().reminderAlerts === false) return;
      checkReminders();
    };
    const t = setTimeout(run, 1200);
    const iv = setInterval(run, 15000);
    return () => {
      clearTimeout(t);
      clearInterval(iv);
    };
  }, [checkReminders]);
}

export default function App() {
  const signedIn = useStore((x) => !!x.auth);
  useReminderPolling();

  return (
    <BrowserRouter>
      {signedIn ? (
        <>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<Navigate to={DEFAULT_PATH} replace />} />
              <Route path="live" element={<LivePage />} />
              <Route path="attendance" element={<AttendancePage />} />
              <Route path="reports" element={<ReportsPage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="leads" element={<LeadsPage />} />
              <Route path="follow-ups" element={<FollowUpsPage />} />
              <Route path="lead-setup" element={<LeadSetupPage />} />
              <Route path="projects" element={<ProjectsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="*" element={<Navigate to={DEFAULT_PATH} replace />} />
            </Route>
          </Routes>
          <DrawerHost />
          <ModalHost />
        </>
      ) : (
        <LoginScreen />
      )}
      <NotificationStack />
    </BrowserRouter>
  );
}
