import { useStore } from '@/store';
import { MODULES } from '@/config/constants';
import { DATA_SCOPES, PERM_ACTIONS, permOf } from '../users.utils';
import s from './PermissionMatrix.module.css';

const LOCKED_MSG = 'Super Admin is a locked system role';

/** One View/Create/Edit/Delete checkbox cell. */
function PermCheck({ on, locked, tip, onToggle }) {
  return (
    <button
      type="button"
      title={tip}
      aria-pressed={on}
      className={[s.check, on && s.on, locked && s.locked].filter(Boolean).join(' ')}
      onClick={onToggle}
    >
      {on ? '✓' : ''}
    </button>
  );
}

/** All / Team / Own data-scope switch (dimmed while View is off). */
function ScopeSwitch({ value, enabled, onSelect }) {
  return (
    <div className={s.scope} style={{ opacity: enabled ? 1 : 0.4 }}>
      {DATA_SCOPES.map(([v, label, tip]) => (
        <button
          key={v}
          type="button"
          title={tip}
          className={value === v ? `${s.scopeBtn} ${s.scopeOn}` : s.scopeBtn}
          onClick={() => onSelect(v)}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

/**
 * Module × action permission matrix for a role. Guards (locked role, View
 * required for scope) flash exactly like the original; the cascade rules
 * (View off clears the rest, any action turns View on) are applied by the
 * store's `togglePerm`.
 */
export default function PermissionMatrix({ role }) {
  const flash = useStore((st) => st.flash);
  const togglePerm = useStore((st) => st.togglePerm);
  const setPermScope = useStore((st) => st.setPermScope);
  const locked = !!role.locked;

  const toggle = (mod, act) => {
    if (locked) return flash(LOCKED_MSG);
    togglePerm(role.id, mod, act);
  };
  const setScope = (mod, p, scope) => {
    if (locked) return flash(LOCKED_MSG);
    if (!p.v) return flash('Turn on View first');
    setPermScope(role.id, mod, scope);
  };

  return (
    <div className={s.wrap}>
      <table className={s.table}>
        <thead>
          <tr>
            <th className={s.modTh}>Module</th>
            {PERM_ACTIONS.map(([a, l]) => (
              <th key={a} className={s.actTh}>
                {l}
              </th>
            ))}
            <th className={s.scopeTh}>Data scope</th>
          </tr>
        </thead>
        <tbody>
          {MODULES.map(([k, label, hint]) => {
            const p = permOf(role, k);
            return (
              <tr key={k}>
                <td className={s.modTd}>
                  <div className={s.modName}>{label}</div>
                  <div className={s.hint}>{hint}</div>
                </td>
                {PERM_ACTIONS.map(([a, actLabel]) => (
                  <td key={a} className={s.actTd}>
                    <PermCheck
                      on={!!p[a]}
                      locked={locked}
                      tip={locked ? 'System role cannot be changed' : `${actLabel} ${label}`}
                      onToggle={() => toggle(k, a)}
                    />
                  </td>
                ))}
                <td className={s.scopeTd}>
                  <ScopeSwitch value={p.scope} enabled={p.v} onSelect={(v) => setScope(k, p, v)} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
