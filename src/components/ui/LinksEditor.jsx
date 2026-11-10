import { LINK_TYPES, LINK_PLACEHOLDER, LINK_HUE } from '@/config/constants';
import { toneStrong } from '@/lib/color';
import { cx } from './cx';
import { Select } from './Select';
import { isValidUrl } from './docs';
import fs from './Field.module.css';
import s from './Documents.module.css';

/**
 * Editable list of project links ({type, url}). Invalid URLs (not starting with http(s)://)
 * get a red border + message. The type select is tinted with LINK_HUE.
 * onChange(nextLinks). "+ Add link" picks Figma first, then Google Drive (as the original).
 */
export function LinksEditor({ links = [], onChange, label = 'Links', className, style }) {
  const upd = (fn) => onChange?.(fn(links));
  return (
    <div className={cx(s.panel, className)} style={style}>
      <div className={s.panelHead}>
        <span>{label}</span>
        <button
          type="button"
          className={s.addLink}
          onClick={() => upd((a) => a.concat({ type: a.some((x) => x.type === 'Figma') ? 'Google Drive' : 'Figma', url: '' }))}
        >
          + Add link
        </button>
      </div>
      {links.map((l, i) => {
        const bad = !!l.url.trim() && !isValidUrl(l.url);
        const t = toneStrong(LINK_HUE[l.type] ?? 265);
        return (
          <div key={i} className={s.linkRow}>
            <Select
              aria-label="Link type"
              style={{ color: t.fg, fontWeight: 600 }}
              value={l.type}
              options={LINK_TYPES}
              searchable={false}
              onChange={(e) => {
                const v = e.target.value;
                upd((a) => a.map((x, j) => (j === i ? { ...x, type: v } : x)));
              }}
            />
            <input
              className={cx(fs.control, bad && fs.invalid)}
              aria-label={`${l.type} URL`}
              aria-invalid={bad || undefined}
              title={bad ? 'Links must start with https://' : undefined}
              value={l.url}
              placeholder={LINK_PLACEHOLDER[l.type] || 'https://…'}
              onChange={(e) => {
                const v = e.target.value;
                upd((a) => a.map((x, j) => (j === i ? { ...x, url: v } : x)));
              }}
            />
            <button type="button" className={s.remove} style={{ height: 36 }} title="Remove link" aria-label="Remove link" onClick={() => upd((a) => a.filter((_, j) => j !== i))}>
              ✕
            </button>
          </div>
        );
      })}
    </div>
  );
}
