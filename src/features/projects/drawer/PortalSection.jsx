import { Button, Toggle } from '@/components/ui';
import { useStore } from '@/store';
import { copyText } from '@/lib/download';
import { dLabel } from '@/lib/date';
import { PORTAL_HOST, badgeTone } from '../lib/view';
import SectionHead from './SectionHead';
import s from './drawer.module.css';

const APPR_HUE = { Pending: 70, Approved: 150, 'Changes requested': 25 };

/** Client portal: on/off toggle, share link, preview, ask approval per milestone. */
export default function PortalSection({ project: sp, info: I }) {
  const portalOn = useStore((st) => st.portalOn);
  const portalOff = useStore((st) => st.portalOff);
  const askApproval = useStore((st) => st.askApproval);
  const setPj = useStore((st) => st.setPj);
  const flash = useStore((st) => st.flash);

  const po = sp.portal || {};
  const url = po.token ? `https://${PORTAL_HOST}${po.token}` : '';
  const pend = I.ms.filter((m) => (m.appr || {}).st === 'Pending').length;
  const sum = po.on
    ? pend
      ? `${pend} milestone${pend > 1 ? 's' : ''} waiting for client approval`
      : 'Live · the client can see progress and approve milestones'
    : `Off · turn on to share a progress link with ${sp.client}`;

  const copy = async () => {
    await copyText(url);
    flash('Client link copied');
  };

  return (
    <section className={s.section}>
      <SectionHead
        title="Client portal"
        sub={sum}
        action={<Toggle checked={!!po.on} onChange={() => (po.on ? portalOff(sp.id) : portalOn(sp.id))} label="Turn the client link on or off" title="Turn the client link on or off" />}
      />
      {po.on && (
        <>
          <div className={s.urlRow}>
            <span className={s.url}>{url}</span>
            <Button variant="secondary" onClick={copy}>
              Copy link
            </Button>
            <Button variant="primary" onClick={() => setPj({ portal: sp.id })}>Open client view</Button>
          </div>
          <div>
            {I.ms.map((m) => {
              const a = m.appr || {};
              const t = badgeTone(APPR_HUE[a.st] || 265);
              const canAsk = m.status !== 'Done' && a.st !== 'Pending';
              return (
                <div key={m.id} className={s.portalMs}>
                  <span className={s.portalN}>{m.n}</span>
                  <div className={s.minw}>
                    <div className={s.portalName}>
                      {m.name} <span className={s.portalStatus}>· {m.status}</span>
                    </div>
                    {a.note && <div className={s.portalNote}>“{a.note}”</div>}
                  </div>
                  <div className={s.portalRight}>
                    {a.st && (
                      <span className={s.apprPill} style={{ background: t.bg, color: t.fg }}>
                        Client: {a.st}
                        {a.at ? ` · ${dLabel(a.at)}` : ''}
                      </span>
                    )}
                    {canAsk && (
                      <Button size="sm" variant="secondary" onClick={() => askApproval(m.id)}>
                        Request approval
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}
