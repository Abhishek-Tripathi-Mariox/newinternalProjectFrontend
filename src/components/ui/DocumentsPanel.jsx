import { attachedMessage } from '@/domain/files';
import { pendingFiles } from '@/api/files';
import { useStore } from '@/store';
import { FileDropzone } from './FileDropzone';
import { DocumentList } from './DocumentList';
import { docSummary } from './docs';
import { cx } from './cx';
import s from './Documents.module.css';

/**
 * "Documents" block: label + summary, dropzone, attachment list.
 *
 * Two modes:
 * - **Saved entity** (drawers): pass `onUpload(files)` (async store action that uploads to the
 *   API), `onKind(doc, kind)` and `onRemove(doc)` (store actions calling the API).
 * - **Form** (modals, entity not created yet): pass `onChange(updater)`; picked files are kept as
 *   pending attachments `{name,size,type,at,kind,url: blob:…, file}` (api/files.pendingFiles) and
 *   uploaded by the store's save action. Flashes "N files attached · k skipped (over 10 MB)".
 * `onAddFiles(files)` still overrides file handling completely.
 */
export function DocumentsPanel({ docs = [], onAddFiles, onUpload, onKind, onRemove, onChange, label = 'Documents', editable = true, className, style }) {
  const flash = useStore((st) => st.flash);

  const addFiles = async (files) => {
    if (onAddFiles) return onAddFiles(files);
    if (onUpload) return onUpload(files);
    const { atts, skipped } = pendingFiles(files);
    if (atts.length) onChange?.((arr = []) => arr.concat(atts));
    flash?.(attachedMessage(atts.length, skipped));
    return undefined;
  };

  return (
    <div className={cx(s.panel, className)} style={style}>
      <div className={s.panelHead}>
        <span>{label}</span>
        <span className={s.sum}>{docSummary(docs)}</span>
      </div>
      {editable && <FileDropzone onFiles={addFiles} />}
      <DocumentList
        docs={docs}
        editable={editable}
        onKind={(i, kind, doc) => (onKind ? onKind(doc, kind) : onChange?.((arr) => arr.map((x, j) => (j === i ? { ...x, kind } : x))))}
        onRemove={(i, doc) => (onRemove ? onRemove(doc) : onChange?.((arr) => arr.filter((_, j) => j !== i)))}
      />
    </div>
  );
}
