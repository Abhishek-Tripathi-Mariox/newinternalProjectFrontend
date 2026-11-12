import { DOC_KINDS } from '@/config/constants';
import { downloadDoc, openDoc, useFileUrl } from '@/api/files';
import { useStore } from '@/store';
import { docMeta, extOf } from './docs';
import { cx } from './cx';
import { Pill } from './Pill';
import { Select } from './Select';
import s from './Documents.module.css';

const isImg = (a) => /^image\//.test(a.type || '') && !!a.url;

/** Image thumbnail (fetched with auth for API files) or extension badge; click opens the file. */
function Thumb({ doc }) {
  const img = isImg(doc);
  const src = useFileUrl(doc, img);
  if (img && src) {
    return (
      <button type="button" onClick={() => openDoc(doc)} title="Open" style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer' }}>
        <img src={src} alt={doc.name} className={s.thumb} />
      </button>
    );
  }
  return <span className={s.ext} aria-hidden="true">{extOf(doc.name)}</span>;
}

/**
 * Attachment rows: image thumbnail or extension badge, name + size/date meta, document-kind
 * select (editable) or pill (read-only), Download link when stored, ✕ remove.
 * Downloads of stored (API) files are fetched with the session's token.
 * onKind(i, kind, doc) · onRemove(i, doc)
 */
export function DocumentList({ docs = [], onKind, onRemove, editable = true, className, style }) {
  const flash = useStore((st) => st.flash);
  if (!docs.length) return null;
  const dl = async (e, a) => {
    e.preventDefault();
    if (!(await downloadDoc(a))) flash?.('Couldn’t download the file — try again');
  };
  return (
    <div className={cx(s.list, className)} style={style}>
      {docs.map((a, i) => (
        <div key={a.id || `${a.name}-${a.at || i}-${i}`} className={cx(s.doc, !editable && s.readonly)}>
          <Thumb doc={a} />
          <div style={{ minWidth: 0 }}>
            <div className={s.name} title={a.name}>{a.name}</div>
            <div className={s.meta}>{docMeta(a)}</div>
          </div>
          {editable ? (
            <Select unstyled className={s.kind} aria-label={`Document type for ${a.name}`} value={a.kind || 'Other'} options={DOC_KINDS}
              onChange={(e) => onKind?.(i, e.target.value, a)} />
          ) : (
            <Pill size="sm" bg="oklch(0.95 0.035 265)" fg="oklch(0.42 0.12 265)">{a.kind || 'Other'}</Pill>
          )}
          {a.url ? (
            <a href={a.url} download={a.name} title="Download" className={s.dl} onClick={(e) => dl(e, a)}>Download</a>
          ) : (
            <span />
          )}
          {editable && (
            <button type="button" className={s.remove} title="Remove" aria-label={`Remove ${a.name}`} onClick={() => onRemove?.(i, a)}>
              ✕
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
