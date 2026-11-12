import { useEffect, useMemo } from 'react';
import { Button, Checkbox, Textarea } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { BLUE, GREEN, MUTED } from '@/lib/color';
import { dateTime, fd } from '@/lib/date';
import { money } from '@/lib/format';
import { CR_STATUS } from '@/config/constants';
import { downloadDoc } from '@/api/files';
import { usePrintCr } from './hooks/usePrintCr';
import { PORTAL_HOST, badgeTone, val } from './lib/view';
import s from './ClientPortalPreview.module.css';

const REVIEW_LINKS = ['Staging URL', 'Prototype', 'Figma', 'Live URL'];

/** A pending CR the client can sign (typed name + agree box) or decline. */
function CrApproval({ c }) {
  const note = useStore((st) => (st.pj.cNote || {})[c.id] || '');
  const sig = useStore((st) => (st.pj.cSig || {})[c.id] || '');
  const agree = useStore((st) => !!(st.pj.cAgree || {})[c.id]);
  const setPj = useStore((st) => st.setPj);
  const crAct = useStore((st) => st.crAct);
  const flash = useStore((st) => st.flash);

  const patch = (key, v) => {
    const { pj } = useStore.getState();
    setPj({ [key]: { ...(pj[key] || {}), [c.id]: v } });
  };
  const run = async (act, ...args) => {
    const err = await crAct(c.id, act, note, ...args);
    if (typeof err === 'string' && err) flash(err);
  };

  return (
    <div className={s.review}>
      <Textarea value={note} onChange={(e) => patch('cNote', val(e))} rows={2} placeholder="Comments (needed if you decline)" />
      <label className={s.sigLabel}>
        Type your full name to sign
        <input className={s.sigInput} value={sig} onChange={(e) => patch('cSig', e.target.value)} placeholder="Your full name" />
      </label>
      <Checkbox
        checked={agree}
        onChange={() => patch('cAgree', !agree)}
        label={`I approve this change for ${money(c.amount || 0)}${c.days ? ` and ${c.days} extra days on the delivery date` : ''}.`}
      />
      <div className={s.btns}>
        <button type="button" className={s.approve} onClick={() => run('clientApprove', { name: sig, agree })}>
          Sign &amp; approve
        </button>
        <button type="button" className={s.decline} onClick={() => run('clientReject')}>
          Decline
        </button>
      </div>
    </div>
  );
}

/** A milestone waiting for the client's sign-off. */
function MilestoneApproval({ m }) {
  const note = useStore((st) => (st.pj.cNote || {})[m.id] || '');
  const setPj = useStore((st) => st.setPj);
  const clientDecide = useStore((st) => st.clientDecide);
  const flash = useStore((st) => st.flash);

  const decide = async (ok) => {
    const err = await clientDecide(m.id, ok, note);
    if (typeof err === 'string' && err) flash(err);
  };

  return (
    <div className={s.review}>
      <div className={s.reviewTitle}>Ready for your review</div>
      <Textarea
        value={note}
        onChange={(e) => setPj({ cNote: { ...(useStore.getState().pj.cNote || {}), [m.id]: val(e) } })}
        rows={2}
        placeholder="Comments (needed if you request changes)"
      />
      <div className={s.btns}>
        <button type="button" className={s.approve} onClick={() => decide(true)}>
          Approve milestone
        </button>
        <button type="button" className={s.decline} onClick={() => decide(false)}>
          Request changes
        </button>
      </div>
    </div>
  );
}

/** Full-screen preview of what the client sees on the project portal (pj.portal). */
export default function ClientPortalPreview() {
  const pid = useStore((st) => st.pj.portal);
  const setPj = useStore((st) => st.setPj);
  const { crs, members } = useScoped();
  const model = useProjectsModel();
  const pdf = usePrintCr();
  const p = model.PRJ[pid];
  const close = () => setPj({ portal: null });

  useEffect(() => {
    if (!p) return undefined;
    const onKey = (e) => e.key === 'Escape' && setPj({ portal: null });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [p, setPj]);

  const projCrs = useMemo(
    () => (p ? (crs || []).filter((c) => c.p === p.id && c.status !== 'Draft').sort((a, b) => b.raised - a.raised) : []),
    [crs, p],
  );

  if (!p) return null;

  const I = model.info(p);
  const done = I.ms.filter((m) => m.status === 'Done').length;
  const prog = `${I.ms.length ? Math.round((done / I.ms.length) * 100) : 0}%`;
  const late = I.health === 'Late';
  const pm = (members.find((m) => m.id === p.pm) || {}).name || '—';
  const url = p.portal && p.portal.token ? PORTAL_HOST + p.portal.token : '';
  const links = (p.links || []).filter((l) => REVIEW_LINKS.includes(l.type));

  return (
    <div className={s.overlay}>
      <div className={s.bar}>
        <span>
          <b>Client preview</b> · what {p.client} sees at <span className={s.barUrl}>{url}</span>
        </span>
        <button type="button" className={s.closeBtn} onClick={close}>
          Close preview
        </button>
      </div>

      <div className={s.page}>
        <div>
          <div className={s.kicker}>Mariox Software · Project portal</div>
          <h1 className={s.title}>{p.name}</h1>
          <div className={s.prepared}>
            Prepared for {p.client} · Project manager {pm}
          </div>
        </div>

        <div className={`${s.card} ${s.progressCard}`}>
          <div className={s.progressTop}>
            <div>
              <div className={s.label}>Overall progress</div>
              <div className={s.big}>{prog}</div>
            </div>
            <div className={s.rightAlign}>
              <span className={s.sched} style={late ? { background: 'oklch(0.95 0.04 25)', color: 'oklch(0.45 0.15 25)' } : { background: 'oklch(0.95 0.04 150)', color: 'oklch(0.42 0.12 150)' }}>
                {late ? 'Behind schedule' : 'On schedule'}
              </span>
              <div className={s.target}>Target delivery {fd(p.due)}</div>
            </div>
          </div>
          <div className={s.track}>
            <div className={s.fill} style={{ width: prog }} />
          </div>
          <div className={s.label}>
            {done} of {I.ms.length} milestones complete
          </div>
        </div>

        {links.length > 0 && (
          <div className={`${s.card} ${s.linksCard}`}>
            <div className={s.cardTitle}>Review links</div>
            <div className={s.links}>
              {links.map((l, i) => (
                <a key={`${l.url}-${i}`} className={s.link} href={l.url} target="_blank" rel="noreferrer">
                  {l.type} ↗
                </a>
              ))}
            </div>
          </div>
        )}

        {projCrs.length > 0 && (
          <div className={`${s.card} ${s.listCard}`}>
            <div className={s.listTitle}>Change requests</div>
            {projCrs.map((c) => {
              const t = badgeTone(CR_STATUS[c.status] ?? 265);
              const docs = (c.docs || []).filter((d) => d.url);
              return (
                <div key={c.id} className={s.crItem}>
                  <div className={s.crHead}>
                    <div className={s.minw}>
                      <div className={s.crTitle}>{c.title}</div>
                      <div className={s.crId}>{c.id}</div>
                    </div>
                    <span className={s.badge} style={{ background: t.bg, color: t.fg }}>
                      {c.status === 'Sent to client' ? 'Waiting for your approval' : c.status}
                    </span>
                  </div>
                  <div className={s.desc}>{c.desc || ''}</div>
                  <div className={s.figures}>
                    <b>{money(c.amount || 0)}</b>
                    <span>{c.hours}h of work</span>
                    <span>{c.days ? `+${c.days} days to delivery` : 'No change to delivery date'}</span>
                  </div>
                  {c.sig && (
                    <div className={s.signed}>
                      <span>
                        ✓ Signed by {c.sig.name} · {dateTime(c.sig.at)}
                      </span>
                      <Button size="sm" variant="secondary" onClick={() => pdf(c)}>
                        Download PDF
                      </Button>
                    </div>
                  )}
                  {docs.length > 0 && (
                    <div className={s.docs}>
                      {docs.map((d, i) => (
                        <a key={d.id || `${d.name}-${i}`} className={s.doc} href={d.url} download={d.name} onClick={(e) => { e.preventDefault(); downloadDoc(d); }}>
                          {d.name} ↓
                        </a>
                      ))}
                    </div>
                  )}
                  {c.status === 'Sent to client' && <CrApproval c={c} />}
                </div>
              );
            })}
          </div>
        )}

        <div className={`${s.card} ${s.listCard}`}>
          <div className={s.listTitle}>Milestones</div>
          {I.ms.map((m) => {
            const a = m.appr || {};
            const isDone = m.status === 'Done';
            const isCur = !!I.curM && I.curM.id === m.id;
            return (
              <div key={m.id} className={s.msItem}>
                <span className={s.msDot} style={{ background: isDone ? GREEN : isCur ? BLUE : 'oklch(0.92 0.006 85)', color: isDone || isCur ? '#fff' : MUTED }}>
                  {isDone ? '✓' : String(m.n)}
                </span>
                <div className={s.msBody}>
                  <div>
                    <div className={s.crTitle}>{m.name}</div>
                    <div className={s.msSub}>
                      Due {fd(m.due)} · {isDone ? 'Complete' : isCur ? 'In progress' : 'Upcoming'}
                    </div>
                  </div>
                  {a.st === 'Pending' && <MilestoneApproval m={m} />}
                  {a.st === 'Approved' && <div className={s.approved}>✓ You approved this{a.at ? ` on ${fd(a.at)}` : ''}</div>}
                  {a.st === 'Changes requested' && <div className={s.changes}>You requested changes{a.note ? `: “${a.note}”` : ''}</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className={s.footer}>Questions? Contact your project manager, {pm}.</div>
      </div>
    </div>
  );
}
