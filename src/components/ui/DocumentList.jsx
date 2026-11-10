import { DOC_KINDS } from '@/config/constants';
import { docMeta, extOf } from './docs';
import { cx } from './cx';
import { Pill } from './Pill';
import { Select } from './Select';
import s from './Documents.module.css';

/**
 * Attachment rows: image thumbnail or extension badge, name + size/date meta, document-kind
 * select (editable) or pill (read-only), Download link when stored, ✕ remove.
 */
export function DocumentList({ docs = [], onKind, onRemove, editable = true, className, style }) {
  if (!docs.length) return null;
  return (
    <div className={cx(s.list, className)} style={style}>
      {docs.map((a, i) => {
        const img = /^image\//.test(a.type || '') && !!a.url;
        return (
          <div key={`${a.name}-${a.at || i}-${i}`} className={cx(s.doc, !editable && s.readonly)}>
            {img ? <img src={a.url} alt={a.name} className={s.thumb} /> : <span className={s.ext} aria-hidden="true">{extOf(a.name)}</span>}
            <div style={{ minWidth: 0 }}>
              <div className={s.name} title={a.name}>{a.name}</div>
              <div className={s.meta}>{docMeta(a)}</div>
            </div>
            {editable ? (
              <Select unstyled className={s.kind} aria-label={`Document type for ${a.name}`} value={a.kind || 'Other'} options={DOC_KINDS}
                onChange={(e) => onKind?.(i, e.target.value)} />
            ) : (
              <Pill size="sm" bg="oklch(0.95 0.035 265)" fg="oklch(0.42 0.12 265)">{a.kind || 'Other'}</Pill>
            )}
            {a.url ? (
              <a href={a.url} download={a.name} title="Download" className={s.dl}>Download</a>
            ) : (
              <span />
            )}
            {editable && (
              <button type="button" className={s.remove} title="Remove" aria-label={`Remove ${a.name}`} onClick={() => onRemove?.(i)}>
                ✕
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
