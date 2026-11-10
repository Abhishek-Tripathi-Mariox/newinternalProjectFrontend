import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { can, scopeState, firstProjectsTab } from '@/domain/permissions';
import { people } from '@/domain/attendance';
import { useNow } from '@/hooks/useNow';
import { DAY, sod } from '@/lib/date';
import { Avatar, Select } from '@/components/ui';
import { cx } from '@/components/ui/cx';
import { TEAM_TABS } from './routes';
import { useSession } from './useSession';
import s from './Sidebar.module.css';

const IDLE_MS = 30 * 6e4;

/** People with status "Working" on the Live board (checked in, not on break, not idle, timer/sales). */
function countWorking(state, now) {
  const L = state.live || {};
  const att = L.att || {};
  const timers = L.timers || {};
  const idle = L.idle || {};
  return people(state).filter((p) => {
    const a = att[p.id];
    if (!a || a.out || a.brk) return false;
    if (idle[p.id] && now - idle[p.id] >= IDLE_MS) return false;
    return p.sales || !!timers[p.id];
  }).length;
}

function NavItem({ to, active, onClick, children, meta }) {
  return (
    <Link to={to} onClick={onClick} className={cx(s.item, active && s.active)} aria-current={active ? 'page' : undefined}>
      {children}
      {meta}
    </Link>
  );
}

/** Dark left navigation: sections, live counts/badges, identity, preview-as picker, log out, settings. */
export default function Sidebar() {
  const { pathname } = useLocation();
  const now = useNow(15000);
  const st = useStore(
    useShallow((x) => ({
      leads: x.leads, fus: x.fus, members: x.members, projects: x.projects, logs: x.logs, tasks: x.tasks, bugs: x.bugs,
      milestones: x.milestones, crs: x.crs, users: x.users, roles: x.roles, viewAs: x.viewAs, live: x.live, pjTab: x.pj?.tab,
    })),
  );
  const setPj = useStore((x) => x.setPj);
  const setViewAs = useStore((x) => x.setViewAs);
  const logout = useStore((x) => x.logout);
  const openModal = useStore((x) => x.openModal);
  const sess = useSession();

  const nav = useMemo(() => {
    const S = scopeState(st);
    const T = sod(now);
    const c = (m) => can(st, m, 'v');
    const logT = {};
    (S.logs || []).forEach((l) => {
      if (l.d === T) logT[l.m] = (logT[l.m] || 0) + l.h;
    });
    const running = (S.projects || []).filter((p) => p.status === 'Running');
    return {
      showLive: !st.viewAs,
      showAtt: !st.viewAs,
      showDash: c('dash'),
      showLeads: c('leads'),
      showFu: c('fu'),
      showLeadSetup: can(st, 'leads', 'e'),
      showProj: ['projects', 'tasks', 'bugs', 'ts'].some(c),
      showTeam: c('team'),
      showUsers: c('users'),
      working: countWorking(st, now),
      leadCount: (S.leads || []).length,
      due: (S.fus || []).filter((f) => !f.done && f.due < T + DAY).length,
      running: running.length,
      missing: (S.members || []).filter((m) => running.some((p) => (p.team || []).includes(m.id)) && !logT[m.id]).length,
      invited: (st.users || []).filter((u) => u.status === 'Invited').length,
      projTab: firstProjectsTab(st),
    };
  }, [st, now]);

  const onProj = pathname.startsWith('/projects');
  const teamActive = onProj && TEAM_TABS.includes(st.pjTab);
  const isAt = (p) => pathname === p || pathname.startsWith(`${p}/`);
  const previewOpts = (st.users || []).filter((u) => u.status === 'Active' && u.id !== 'u-ceo');

  return (
    <aside className={s.aside} aria-label="Main navigation">
      <div className={s.brand}>
        <div className={s.mark} aria-hidden="true">M</div>
        <div>
          <div className={s.brandName}>Mariox Software</div>
          <div className={s.brandSub}>CEO Portal</div>
        </div>
      </div>

      <nav className={s.nav}>
        {nav.showLive && (
          <NavItem to="/live" active={isAt('/live')} meta={<span className={s.meta}>{nav.working} working</span>}>
            <span className={s.itemLabel}><span className={s.liveDot} aria-hidden="true" />Live now</span>
          </NavItem>
        )}
        {nav.showAtt && <NavItem to="/attendance" active={isAt('/attendance')}>Attendance</NavItem>}
        {nav.showAtt && <NavItem to="/reports" active={isAt('/reports')}>Reports</NavItem>}
        {nav.showDash && <NavItem to="/dashboard" active={isAt('/dashboard')}>Dashboard</NavItem>}

        {(nav.showLeads || nav.showFu) && <div className={s.section}>Sales</div>}
        {nav.showLeads && (
          <NavItem to="/leads" active={isAt('/leads')} meta={<span className={s.meta}>{nav.leadCount}</span>}>
            <span>Leads</span>
          </NavItem>
        )}
        {nav.showFu && (
          <NavItem
            to="/follow-ups"
            active={isAt('/follow-ups')}
            meta={nav.due > 0 ? <span className={s.badgeRed} aria-label={`${nav.due} due`}>{nav.due}</span> : null}
          >
            <span>Follow-ups</span>
          </NavItem>
        )}
        {nav.showLeadSetup && <NavItem to="/lead-setup" active={isAt('/lead-setup')}>Lead setup</NavItem>}

        {(nav.showProj || nav.showTeam) && <div className={s.section}>Delivery</div>}
        {nav.showProj && (
          <NavItem
            to="/projects"
            active={onProj && !teamActive}
            onClick={() => setPj({ tab: nav.projTab })}
            meta={<span className={s.meta}>{nav.running}</span>}
          >
            <span>Projects</span>
          </NavItem>
        )}
        {nav.showTeam && (
          <NavItem
            to="/projects"
            active={teamActive}
            onClick={() => setPj({ tab: 'team' })}
            meta={nav.missing > 0 ? <span className={s.badgeAmber} title="Timesheets not submitted today">{nav.missing}</span> : null}
          >
            <span>Team &amp; hours</span>
          </NavItem>
        )}

        {nav.showUsers && (
          <>
            <div className={s.section}>Admin</div>
            <NavItem
              to="/users"
              active={isAt('/users')}
              meta={nav.invited > 0 ? <span className={s.meta} title="Pending invites">{nav.invited} invited</span> : null}
            >
              <span>Users &amp; roles</span>
            </NavItem>
          </>
        )}
      </nav>

      <div className={s.foot}>
        <div className={s.who}>
          <Avatar name={sess.me.name} h={sess.me.h ?? 265} size={32} title="" />
          <div style={{ minWidth: 0 }}>
            <div className={s.whoName}>{sess.me.name}</div>
            <div className={s.whoRole}>{sess.me.roleName}</div>
          </div>
        </div>
        {sess.canPreview && (
          <label className={s.picker}>
            Preview as
            <Select
              unstyled
              className={s.pickerSelect}
              value={st.viewAs || ''}
              onChange={(e) => setViewAs(e.target.value || null)}
              options={[{ value: '', label: 'Myself (Super Admin)' }, ...previewOpts.map((u) => ({ value: u.id, label: `${u.name} · ${sess.roleName(u.role)}` }))]}
            />
          </label>
        )}
        {sess.auth && (
          <div className={s.footBtns}>
            {sess.authIsSuper && !sess.previewing && (
              <button type="button" className={s.footBtn} onClick={() => openModal('settings')}>Settings</button>
            )}
            <button type="button" className={s.footBtn} onClick={logout}>Log out</button>
          </div>
        )}
      </div>
    </aside>
  );
}
