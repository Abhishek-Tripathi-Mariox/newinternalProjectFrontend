import { lazy } from 'react';
import { useStore } from '@/store';
import LazyBoundary from './LazyBoundary';

/** modal.kind → lazily-loaded modal component. Each receives {...modal.props, onClose}. */
const MODALS = {
  fu: lazy(() => import('@/features/followups/FollowUpModal')),
  lead: lazy(() => import('@/features/leads/LeadModal')),
  quote: lazy(() => import('@/features/leads/QuoteModal')),
  proj: lazy(() => import('@/features/projects/NewProjectModal')),
  cr: lazy(() => import('@/features/projects/ChangeRequestModal')),
  log: lazy(() => import('@/features/projects/LogHoursModal')),
  task: lazy(() => import('@/features/projects/TaskModal')),
  bug: lazy(() => import('@/features/projects/BugModal')),
  integView: lazy(() => import('@/features/projects/IntegrationViewModal')),
  integ: lazy(() => import('@/features/projects/IntegrationModal')),
  pfu: lazy(() => import('@/features/project-followups/ProjectFollowUpModal')),
  user: lazy(() => import('@/features/users/UserModal')),
  brk: lazy(() => import('@/features/session/BreakModal')),
  eos: lazy(() => import('@/features/session/EndShiftModal')),
  settings: lazy(() => import('@/features/settings/SettingsModal')),
};

/** Renders the single active modal from store.modal. */
export default function ModalHost() {
  const modal = useStore((x) => x.modal);
  const closeModal = useStore((x) => x.closeModal);
  const C = modal && MODALS[modal.kind];
  if (!C) return null;
  return (
    <LazyBoundary resetKey={modal} onReset={closeModal}>
      <C key={modal.kind + (modal.props?.editId || '')} {...(modal.props || {})} onClose={closeModal} />
    </LazyBoundary>
  );
}
