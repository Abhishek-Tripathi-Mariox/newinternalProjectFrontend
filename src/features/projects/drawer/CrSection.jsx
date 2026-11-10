import { useCallback, useMemo } from 'react';
import { usePrintCr } from '../hooks/usePrintCr';
import { Button } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useIsPM } from '@/hooks/useIsPM';
import { hh, money } from '@/lib/format';
import CrCard from '../components/CrCard';
import { useCrContext } from '../hooks/useCrContext';
import { useProjectNav } from '../hooks/useProjectNav';
import { crView } from '../lib/cr';
import { CR_LIVE } from '../lib/view';
import SectionHead from './SectionHead';
import s from './drawer.module.css';

/** Change requests for one project, with PM workflow buttons. */
export default function CrSection({ project: sp }) {
  const { crs } = useScoped();
  const crAct = useStore((st) => st.crAct);
  const flash = useStore((st) => st.flash);
  const openModal = useStore((st) => st.openModal);
  const isPM = useIsPM();
  const ctx = useCrContext();
  const { openCr } = useProjectNav();
  const pdf = usePrintCr();

  const list = useMemo(() => (crs || []).filter((c) => c.p === sp.id).sort((a, b) => b.raised - a.raised), [crs, sp.id]);
  const rows = useMemo(() => list.map((c) => crView(c, ctx)), [list, ctx]);

  const apr = list.filter((c) => CR_LIVE.includes(c.status));
  const wait = list.filter((c) => c.status === 'Sent to client').length;
  const sum = list.length
    ? `${list.length} CR${list.length > 1 ? 's' : ''} · +${hh(apr.reduce((x, c) => x + c.hours, 0))} and +${money(apr.reduce((x, c) => x + (c.amount || 0), 0))} approved${wait ? ` · ${wait} waiting for client` : ''}`
    : 'Scope changes with hours, value, timeline and documents';

  const onOpen = useCallback((r) => openCr(r.c.p, r.id), [openCr]);
  const onAct = useCallback(
    (id, act) => {
      // "Mark approved" needs the client signer's name → handled inside the CR modal.
      if (act === 'approve') return openModal('cr', { pid: sp.id, editId: id });
      const err = crAct(id, act);
      if (typeof err === 'string' && err) flash(err);
    },
    [crAct, flash, openModal, sp.id],
  );

  return (
    <section className={s.section}>
      <SectionHead title="Change requests" sub={sum} action={isPM(sp) && <Button size="sm" variant="primary" onClick={() => openCr(sp.id)}>+ New CR</Button>} />
      {rows.map((r) => (
        <CrCard key={r.id} row={r} onOpen={onOpen} onAct={onAct} onPdf={pdf} />
      ))}
    </section>
  );
}
