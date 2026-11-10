import { lazy } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import LazyBoundary from './LazyBoundary';

const LeadDrawer = lazy(() => import('@/features/leads/LeadDrawer'));
const ProjectDrawer = lazy(() => import('@/features/projects/ProjectDrawer'));
const MemberDrawer = lazy(() => import('@/features/projects/MemberDrawer'));
const ClientPortalPreview = lazy(() => import('@/features/projects/ClientPortalPreview'));

/** Side drawers driven by store state (each reads its own data; no props). */
export default function DrawerHost() {
  const { selLead, selP, selM, portal } = useStore(
    useShallow((x) => ({ selLead: x.selLead, selP: x.pj?.selP, selM: x.pj?.selM, portal: x.pj?.portal })),
  );
  const selectLead = useStore((x) => x.selectLead);
  const setPj = useStore((x) => x.setPj);
  return (
    <>
      {selLead && (
        <LazyBoundary resetKey={selLead} onReset={() => selectLead(null)}>
          <LeadDrawer />
        </LazyBoundary>
      )}
      {selP && (
        <LazyBoundary resetKey={selP} onReset={() => setPj({ selP: null })}>
          <ProjectDrawer />
        </LazyBoundary>
      )}
      {selM && (
        <LazyBoundary resetKey={selM} onReset={() => setPj({ selM: null })}>
          <MemberDrawer />
        </LazyBoundary>
      )}
      {portal && (
        <LazyBoundary resetKey={portal} onReset={() => setPj({ portal: null })}>
          <ClientPortalPreview />
        </LazyBoundary>
      )}
    </>
  );
}
