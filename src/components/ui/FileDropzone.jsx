import { useRef, useState } from 'react';
import { cx } from './cx';
import s from './Documents.module.css';

export const DROP_HINT = 'SOW, FRD, BRD, proposal, contract, NDA, wireframes · several at once · up to 10 MB each';

/**
 * Click-or-drop file picker. onFiles(files) receives an Array<File> copy of the FileList
 * (safe after the input is reset). Keyboard: focus + Enter/Space opens the picker.
 */
export function FileDropzone({ onFiles, label = 'Click to add files or drag them here', hint = DROP_HINT, compact, multiple = true, accept, className, style }) {
  const [over, setOver] = useState(false);
  const inputRef = useRef(null);
  const emit = (list) => {
    const arr = Array.from(list || []);
    if (arr.length) onFiles?.(arr);
  };
  return (
    <label
      className={cx(s.drop, compact && s.compact, over && s.dragOver, className)}
      style={style}
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes('Files')) return;
        e.preventDefault();
        if (!over) setOver(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        emit(e.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        multiple={multiple}
        accept={accept}
        className="sr-only"
        onChange={(e) => {
          emit(e.target.files);
          e.target.value = '';
        }}
      />
      <span className={s.dropLabel}>{label}</span>
      {hint && !compact && <span className={s.dropHint}>{hint}</span>}
    </label>
  );
}
