import { readFiles, attachedMessage } from '@/domain/files';
import { useStore } from '@/store';
import { FileDropzone } from './FileDropzone';
import { DocumentList } from './DocumentList';
import { docSummary } from './docs';
import { cx } from './cx';
import s from './Documents.module.css';

/**
 * "Documents" block: label + summary, dropzone, attachment list.
 * docs: attachment[] · onChange(fn) receives an updater `(docs) => nextDocs`.
 * Files are read via domain/files.readFiles (10 MB max, > 1.5 MB stored as name only) and
 * appended through onChange, with the original "N files attached · k skipped" toast.
 * Pass `onAddFiles(files)` to take over file handling yourself instead.
 */
export function DocumentsPanel({ docs = [], onAddFiles, onChange, label = 'Documents', editable = true, className, style }) {
  const flash = useStore((st) => st.flash);

  const addFiles = async (files) => {
    if (onAddFiles) return onAddFiles(files);
    const { atts, skipped } = await readFiles(files);
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
        onKind={(i, kind) => onChange?.((arr) => arr.map((x, j) => (j === i ? { ...x, kind } : x)))}
        onRemove={(i) => onChange?.((arr) => arr.filter((_, j) => j !== i))}
      />
    </div>
  );
}
