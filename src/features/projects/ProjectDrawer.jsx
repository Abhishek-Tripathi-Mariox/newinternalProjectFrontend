import { Drawer, ProgressBar, Select } from '@/components/ui';
import { useStore } from '@/store';
import { useScoped } from '@/hooks/useScoped';
import { useProjectsModel } from '@/hooks/useProjectsModel';
import { INK, RED, barColor } from '@/lib/color';
import { fd } from '@/lib/date';
import { hh, money, pctW } from '@/lib/format';
import { HealthPill } from './components/bits';
import PortalSection from './drawer/PortalSection';
import DocsLinksSection from './drawer/DocsLinksSection';
import MilestonesSection from './drawer/MilestonesSection';
import CrSection from './drawer/CrSection';
import TeamSection from './drawer/TeamSection';
import DayWorkSection from './drawer/DayWorkSection';
import { BugsSection, RecentLogsSection, TasksSection } from './drawer/WorkItemsSections';
import { STATUS_KEYS } from './lib/view';
import s from './drawer/drawer.module.css';

function Fact({ label, children }) {
  return (
    <div>
      <div className={s.factLabel}>{label}</div>
      <div className={s.factValue}>{children}</div>
    </div>
  );
}

/** Project detail drawer (pj.selP). Rendered by DrawerHost; takes no props. */
export default function ProjectDrawer() {
  const selP = useStore((st) => st.pj.selP);
  const setPj = useStore((st) => st.setPj);
  const updProj = useStore((st) => st.updProj);
  const flash = useStore((st) => st.flash);
  const { members } = useScoped();
  const model = useProjectsModel();

  const sp = model.PRJ[selP];
  if (!sp) return null;

  const I = model.info(sp);
  const H = model.g(`p:${sp.id}`);
  const rem = I.budget - I.used;
  const pm = members.find((m) => m.id === sp.pm);
  const close = () => setPj({ selP: null });
  const sectionProps = { project: sp, info: I, model };

  const stats = [
    { label: 'Hours used', value: hh(I.used), sub: `of ${hh(I.budget)} · ${Math.round(I.pct * 100)}%`, color: I.pct > 1 ? RED : INK },
    { label: 'Today', value: hh(H.today) },
    { label: 'Yesterday', value: hh(H.yest) },
    { label: 'This week', value: hh(H.week) },
    { label: 'This month', value: hh(H.month) },
    { label: rem >= 0 ? 'Remaining' : 'Over budget', value: hh(Math.abs(rem)), color: rem < 0 ? RED : INK },
  ];

  const header = (
    <div className={s.minw}>
      <div className={s.headMeta}>
        <span className={s.mono}>{sp.id}</span> · {sp.service}
      </div>
      <h2 className={s.headName}>{sp.name}</h2>
      <div className={s.headClient}>{sp.client}</div>
    </div>
  );

  const statusSelect = (
    <Select
      unstyled
      className={s.statusSelect}
      style={{ background: I.st.bg, color: I.st.fg }}
      value={sp.status}
      aria-label="Project status"
      options={STATUS_KEYS}
      onChange={(e) => {
        updProj(sp.id, { status: e.target.value });
        flash(`${sp.name} → ${e.target.value}`);
      }}
    />
  );

  return (
    <Drawer open onClose={close} width={760} header={header} actions={statusSelect} label={sp.name}>
        <div className={s.facts}>
          <Fact label="Project manager">{pm ? pm.name : '—'}</Fact>
          <Fact label="Start">{fd(sp.start)}</Fact>
          <Fact label="Due">
            <span style={{ color: I.dueColor }}>{I.dueLabel}</span> <span className={s.factSub}>· {I.dueSub}</span>
          </Fact>
          <Fact label="Contract value">{sp.value ? money(sp.value) : '—'}</Fact>
          <Fact label="Health">
            <HealthPill bg={I.hBg} fg={I.hFg}>
              {I.hLabel}
            </HealthPill>
          </Fact>
        </div>

        <div className={s.statsWrap}>
          <div className={s.stats}>
            {stats.map((x) => (
              <div key={x.label} className={s.stat}>
                <div className={s.statLabel}>{x.label}</div>
                <div className={s.statValue} style={{ color: x.color || INK }}>
                  {x.value}
                </div>
                <div className={s.statSub}>{x.sub || ''}</div>
              </div>
            ))}
          </div>
          <ProgressBar width={pctW(I.pct)} color={barColor(I.pct)} />
        </div>

        {I.why.length > 0 && (
          <div className={s.why}>
            <div className={s.whyTitle}>Health score {I.score}/100 · what’s pulling it down</div>
            {I.why.map((t) => (
              <div key={t} className={s.whyItem}>
                <span className={s.whyDot} />
                {t}
              </div>
            ))}
          </div>
        )}

        <PortalSection {...sectionProps} />
        <DocsLinksSection {...sectionProps} />
        <MilestonesSection {...sectionProps} />
        <CrSection {...sectionProps} />
        <TeamSection {...sectionProps} />
        <TasksSection {...sectionProps} />
        <BugsSection {...sectionProps} />
        <DayWorkSection {...sectionProps} />
        <RecentLogsSection {...sectionProps} />
    </Drawer>
  );
}
