import { useState } from 'react';
import { cx } from './cx';
import s from './KanbanBoard.module.css';

const MIME = 'text/plain';

/**
 * Drag-and-drop board (HTML5 DnD).
 * columns: [{key, name, dot, count, meta, items, onAdd?, addLabel?, emptyText?}]
 * getId(item) → id · renderCard(item, {dragging}) → card element · onMove(id, toKey) only fires
 * when the card lands in a different column.
 * Each card is wrapped in an unstyled draggable div — use `KanbanCard` (or your own card
 * component) inside renderCard for the white card chrome.
 * `emptyText` (board or column level) shows a dashed drop hint in empty columns.
 */
export function KanbanBoard({ columns = [], getId = (x) => x.id, renderCard, onMove, minColWidth = 250, emptyText, className, style, label = 'Board' }) {
  const [dragId, setDragId] = useState(null);
  const [overKey, setOverKey] = useState(null);

  const fromKeyOf = (id) => columns.find((c) => (c.items || []).some((it) => String(getId(it)) === String(id)))?.key;

  const end = () => {
    setDragId(null);
    setOverKey(null);
  };

  return (
    <div className={cx(s.board, className)} style={style} role="list" aria-label={label}>
      {columns.map((col) => {
        const over = overKey === col.key && dragId != null;
        const items = col.items || [];
        const empty = col.emptyText ?? emptyText;
        return (
          <section
            key={col.key}
            role="listitem"
            aria-label={`${col.name} (${col.count ?? items.length})`}
            className={cx(s.col, over && s.over)}
            style={{ flex: `0 0 ${minColWidth}px` }}
            onDragOver={(e) => {
              if (dragId == null && !e.dataTransfer.types.includes(MIME)) return;
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              if (overKey !== col.key) setOverKey(col.key);
            }}
            onDragLeave={(e) => {
              if (!e.currentTarget.contains(e.relatedTarget)) setOverKey((k) => (k === col.key ? null : k));
            }}
            onDrop={(e) => {
              e.preventDefault();
              const id = e.dataTransfer.getData(MIME) || dragId;
              const from = id != null ? fromKeyOf(id) : undefined;
              end();
              if (id != null && from !== undefined && from !== col.key) onMove?.(id, col.key);
            }}
          >
            <div className={s.head}>
              <span className={s.name}>
                {col.dot && <span className={s.dot} style={{ background: col.dot }} aria-hidden="true" />}
                {col.name}
                <span className={s.count}>{col.count ?? items.length}</span>
              </span>
              {col.meta != null && <span className={s.meta}>{col.meta}</span>}
              {col.onAdd && (
                <button type="button" className={s.add} onClick={col.onAdd} title={col.addLabel || `Add to ${col.name}`} aria-label={col.addLabel || `Add to ${col.name}`}>
                  +
                </button>
              )}
            </div>
            {items.map((item) => {
              const id = getId(item);
              const dragging = dragId != null && String(dragId) === String(id);
              return (
                <div
                  key={id}
                  draggable
                  className={cx(s.item, dragging && s.dragging)}
                  onDragStart={(e) => {
                    e.dataTransfer.effectAllowed = 'move';
                    e.dataTransfer.setData(MIME, String(id));
                    setDragId(id);
                  }}
                  onDragEnd={end}
                >
                  {renderCard(item, { dragging })}
                </div>
              );
            })}
            {!items.length && empty && <div className={s.empty}>{empty}</div>}
          </section>
        );
      })}
    </div>
  );
}

/** Standard white kanban card chrome (radius 10, hover ring). Clickable when `onClick` is set. */
export function KanbanCard({ onClick, children, className, style, title }) {
  return (
    <div
      className={cx(s.card, onClick && s.clickable, className)}
      style={style}
      title={title}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                onClick(e);
              }
            }
          : undefined
      }
    >
      {children}
    </div>
  );
}
