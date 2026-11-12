import { useMemo } from 'react';
import { useStore } from '@/store';
import { DocumentsPanel, Drawer, Select } from '@/components/ui';
import FollowUpRow from '@/features/followups/components/FollowUpRow';
import { dLabel } from '@/lib/date';
import { money } from '@/lib/format';
import { useLeadInsights } from './useLeadInsights';
import { ownerOf } from './leadUtils';
import StageStepper from './components/StageStepper';
import LeadQuotes from './components/LeadQuotes';
import LeadActivity from './components/LeadActivity';
import sec from './components/DrawerSection.module.css';
import s from './LeadDrawer.module.css';
import { getActiveOwners } from '@/store/owners';

/** Lead detail side panel. Reads `selLead` from the store; renders nothing when none is selected. */
export default function LeadDrawer() {
  const selLead = useStore((st) => st.selLead);
  const { leadMap, fus, ins, now } = useLeadInsights();
  const lead = selLead ? leadMap[selLead] : null;
  const lfus = useMemo(
    () => (lead ? fus.filter((f) => f.leadId === lead.id).sort((a, b) => (a.done - b.done) || a.due - b.due) : []),
    [fus, lead],
  );
  const selectLead = useStore((st) => st.selectLead);
  if (!lead) return null;
  return <LeadDrawerBody key={lead.id} lead={lead} lfus={lfus} ins={ins} now={now} leadMap={leadMap} onClose={() => selectLead(null)} />;
}

function LeadDrawerBody({ lead: l, lfus, ins, now, leadMap, onClose }) {
  const setLead = useStore((st) => st.setLead);
  const logAct = useStore((st) => st.logAct);
  const flash = useStore((st) => st.flash);
  const openModal = useStore((st) => st.openModal);
  const selectLead = useStore((st) => st.selectLead);
  const mergeLead = useStore((st) => st.mergeLead);
  const setLeadDocs = useStore((st) => st.setLeadDocs);
  const addLeadDocs = useStore((st) => st.addLeadDocs);

  const score = ins.scoreOf[l.id];
  const sp = ins.scorePill(score);
  const ds = ins.daysSince(l.id);
  const stale = ins.isStale(l);
  const dq = ins.dupOf[l.id] || {};
  const dups = Object.keys(dq).map((id) => leadMap[id]).filter(Boolean);
  const phone = (l.phone || '').trim();

  const setStatus = (k) => { setLead(l.id, 'status', k); flash(`Status → ${k}`); };
  const transfer = (e) => {
    const v = e.target.value;
    if (!v) return;
    setLead(l.id, 'owner', v);
    flash(`${l.company} transferred to ${ownerOf(v).name}`);
  };
  const saveNotes = (e) => {
    if (e.target.value !== (l.notes || '')) { setLead(l.id, 'notes', e.target.value); flash('Note saved'); }
  };
  const schedule = () => openModal('fu', { leadId: l.id });

  const header = (
    <div className={s.minw}>
      <div className={s.idLine}>{l.id} · created {dLabel(l.created)}</div>
      <div className={s.company}>{l.company}</div>
      <div className={s.contact}><span>{l.contact}</span><span>{l.phone || '—'}</span><span className={s.email}>{l.email || '—'}</span></div>
      <div className={s.badges}>
        <span className={s.badge} style={{ background: sp.bg, color: sp.fg, fontWeight: 600 }}>Score {score}</span>
        {ins.isHot(l) && <span className={`${s.badge} ${s.hot}`}>Hot lead</span>}
        <span
          className={s.badge}
          style={{ background: stale ? 'oklch(0.96 0.05 70)' : 'oklch(0.96 0.004 85)', color: stale ? 'oklch(0.45 0.12 70)' : 'oklch(0.45 0.012 265)' }}
        >
          Last contact {ds === 0 ? 'today' : `${ds}d ago`}
        </span>
      </div>
    </div>
  );

  const quick = (
    <div className={s.quick}>
      <a href={`tel:${phone.replace(/\s/g, '')}`} className={s.quickBtn} onClick={() => logAct(l.id, 'call', `Called ${l.contact}`)}>Call</a>
      <a href={`https://wa.me/${phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className={`${s.quickBtn} ${s.wa}`}
        onClick={() => logAct(l.id, 'whatsapp', `WhatsApp message to ${l.contact}`)}>WhatsApp</a>
      <a href={`mailto:${l.email || ''}`} className={s.quickBtn} onClick={() => logAct(l.id, 'email', `Emailed ${l.email || l.contact}`)}>Email</a>
      <button type="button" className={s.quickPrimary} onClick={schedule}>+ Follow-up</button>
    </div>
  );

  return (
    <Drawer
      open
      onClose={onClose}
      width={560}
      label={l.company}
      header={header}
      actions={<button type="button" className={s.editBtn} onClick={() => openModal('lead', { editId: l.id })}>Edit</button>}
      headerBelow={quick}
      bodyClassName={s.body}
    >
        <StageStepper value={l.status} onChange={setStatus} />

        <div className={s.facts}>
          <div className={s.fact}><div className={s.factLabel}>Deal value</div><div className={s.factBig}>{money(l.value)}</div></div>
          <div className={`${s.fact} ${s.ownerFact}`}>
            <div className={s.ownerRow}>
              <span className={s.factLabel}>Owner</span>
              <Select unstyled value="" placeholder="Transfer…" onChange={transfer} className={s.transfer} aria-label="Transfer lead"
                options={getActiveOwners().filter((o) => o.id !== l.owner).map((o) => ({ value: o.id, label: o.name }))} />
            </div>
            <div className={s.ownerName}>{ownerOf(l.owner).name}</div>
            <div className={s.factLabel}>First owner · <span className={s.firstOwner}>{ownerOf(l.firstOwner || l.owner).name}</span> · locked</div>
          </div>
          <div className={s.fact}><div className={s.factLabel}>Service</div><div className={s.factVal}>{l.service}</div></div>
          <div className={s.fact}><div className={s.factLabel}>Source</div><div className={s.factVal}>{l.source}</div></div>
        </div>

        {dups.length > 0 && (
          <div className={s.dups}>
            <div className={s.dupTitle}>Possible duplicate</div>
            {dups.map((o) => (
              <div key={o.id} className={s.dupRow}>
                <span className={s.dupText}><b>{o.id}</b> · {o.company} <span className={s.muted}>· same {dq[o.id]}</span></span>
                <button type="button" className={sec.sm} onClick={() => selectLead(o.id)}>Open</button>
                <button type="button" className={s.mergeBtn} onClick={() => mergeLead(l.id, o.id)}>Merge into this lead</button>
              </div>
            ))}
          </div>
        )}

        <label className={s.notes}>
          Notes
          <textarea
            defaultValue={l.notes || ''}
            onBlur={saveNotes}
            placeholder="Add context about this lead… saves automatically"
            rows={3}
            className={s.notesInput}
          />
        </label>

        <div>
          <div className={sec.head}>
            <h3 className={sec.h3}>Follow-ups <span className={sec.count}>{lfus.filter((f) => !f.done).length} open</span></h3>
            <button type="button" className={sec.link} onClick={schedule}>+ Schedule</button>
          </div>
          {lfus.map((f) => <FollowUpRow key={f.id} fu={f} variant="lead" now={now} />)}
          {lfus.length === 0 && <div className={sec.empty}>No follow-ups yet.</div>}
        </div>

        <LeadQuotes lead={l} />

        <LeadActivity lead={l} fus={lfus} now={now} />

        <DocumentsPanel docs={l.docs || []} onAddFiles={(files) => addLeadDocs(l.id, files)} onChange={(fn) => setLeadDocs(l.id, fn)} />
    </Drawer>
  );
}
