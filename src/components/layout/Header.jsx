import { useLocation } from 'react-router-dom';
import { useShallow } from 'zustand/react/shallow';
import { useStore } from '@/store';
import { can } from '@/domain/permissions';
import { useNow } from '@/hooks/useNow';
import { Button } from '@/components/ui';
import { pageOf } from './routes';
import { useSession } from './useSession';
import SessionControls from './SessionControls';
import s from './Header.module.css';

/** Sticky top bar: crumb / page title, session controls or today's date, page actions. */
export default function Header() {
  const { pathname } = useLocation();
  const page = pageOf(pathname);
  const now = useNow(15000);
  const sess = useSession();
  const perm = useStore(useShallow((x) => ({ viewAs: x.viewAs, users: x.users, roles: x.roles })));
  const pf = useStore((x) => x.pj?.f);
  const openModal = useStore((x) => x.openModal);
  const c = (m, a) => can(perm, m, a);

  const isProj = page.path === '/projects';
  const isUsers = page.path === '/users';
  const f = pf || {};

  return (
    <header className={s.header}>
      <div className={s.crumbs}>
        <span className={s.crumb}>{page.crumb}</span>
        <span className={s.sep} aria-hidden="true">/</span>
        <span className={s.title} aria-current="page">{page.title}</span>
      </div>
      <div className={s.right}>
        {sess.pid ? (
          <SessionControls pid={sess.pid} now={now} />
        ) : (
          <span className={s.today}>
            {new Date(now).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
        {page.path === '/leads' && c('leads', 'c') && (
          <Button onClick={() => openModal('lead', {})}>+ New lead</Button>
        )}
        {isProj && c('projects', 'c') && <Button onClick={() => openModal('proj', {})}>+ New project</Button>}
        {isProj && c('bugs', 'c') && (
          <Button variant="dangerOutline" onClick={() => openModal('bug', { p: f.project || undefined })}>+ Report bug</Button>
        )}
        {isProj && c('ts', 'c') && (
          <Button variant="primary" onClick={() => openModal('log', { member: f.member || undefined, project: f.project || undefined })}>
            + Log hours
          </Button>
        )}
        {isUsers && <Button variant="primary" onClick={() => openModal('user', {})}>+ Invite user</Button>}
        {!isProj && !isUsers && c('fu', 'c') && (
          <Button variant="primary" onClick={() => openModal('fu', {})}>+ New follow-up</Button>
        )}
      </div>
    </header>
  );
}
