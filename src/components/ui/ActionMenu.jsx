import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import s from './ActionMenu.module.css';

const GAP = 4;
const EDGE = 8;

/**
 * "⋯" overflow button that opens a small popover menu.
 * items: [{label, onClick, danger?, disabled?, hidden?, title?, key?}] — hidden items are skipped;
 * renders nothing when no item is visible. `align` 'end' (default) lines the menu up with the
 * button's right edge, 'start' with its left edge. The menu is portalled with position: fixed,
 * flips above the button near the bottom of the viewport and stays inside it horizontally.
 * Closes on outside click, Escape, Tab, scroll or resize. Arrow keys / Home / End move focus.
 * Clicks and keys don't propagate, so it is safe inside clickable table rows.
 */
export function ActionMenu({ items = [], label = 'More actions', align = 'end', children = '⋯', className, style, menuClassName }) {
  const shown = items.filter((it) => it && !it.hidden);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const btnRef = useRef(null);
  const menuRef = useRef(null);
  const menuId = useId();

  const close = useCallback((focusButton) => {
    setOpen(false);
    setPos(null);
    if (focusButton) btnRef.current?.focus();
  }, []);

  // Measure the menu once rendered (hidden), then place it next to the button.
  useLayoutEffect(() => {
    if (!open || !btnRef.current || !menuRef.current) return;
    const b = btnRef.current.getBoundingClientRect();
    const m = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let top = b.bottom + GAP;
    if (top + m.height > vh - EDGE && b.top - GAP - m.height >= EDGE) top = b.top - GAP - m.height;
    let left = align === 'start' ? b.left : b.right - m.width;
    left = Math.max(EDGE, Math.min(left, vw - EDGE - m.width));
    setPos({ top: Math.max(EDGE, top), left });
  }, [open, align]);

  // Focus the first enabled item once placed.
  useEffect(() => {
    if (!open || !pos) return;
    const first = menuRef.current?.querySelector('[role="menuitem"]:not([disabled])');
    first?.focus();
  }, [open, pos]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current?.contains(e.target) || btnRef.current?.contains(e.target)) return;
      close(false);
    };
    const onMove = (e) => {
      if (menuRef.current?.contains(e.target)) return;
      close(false);
    };
    const onResize = () => close(false);
    document.addEventListener('mousedown', onDown, true);
    document.addEventListener('touchstart', onDown, true);
    window.addEventListener('scroll', onMove, true);
    window.addEventListener('resize', onResize);
    return () => {
      document.removeEventListener('mousedown', onDown, true);
      document.removeEventListener('touchstart', onDown, true);
      window.removeEventListener('scroll', onMove, true);
      window.removeEventListener('resize', onResize);
    };
  }, [open, close]);

  if (!shown.length) return null;

  const focusables = () => Array.from(menuRef.current?.querySelectorAll('[role="menuitem"]:not([disabled])') || []);

  const onMenuKey = (e) => {
    e.stopPropagation();
    const list = focusables();
    const i = list.indexOf(document.activeElement);
    const go = (n) => {
      e.preventDefault();
      list[(n + list.length) % list.length]?.focus();
    };
    if (e.key === 'Escape') {
      e.preventDefault();
      close(true);
    } else if (e.key === 'Tab') {
      close(false);
    } else if (e.key === 'ArrowDown') go(i + 1);
    else if (e.key === 'ArrowUp') go(i < 0 ? -1 : i - 1);
    else if (e.key === 'Home') go(0);
    else if (e.key === 'End') go(-1);
  };

  const onBtnKey = (e) => {
    e.stopPropagation();
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      setOpen(true);
    } else if (e.key === 'Escape' && open) {
      e.preventDefault();
      close(true);
    }
  };

  const run = (it) => (e) => {
    e.stopPropagation();
    if (it.disabled) return;
    close(true);
    it.onClick?.(e);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className={cx(s.trigger, open && s.triggerOn, className)}
        style={style}
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          if (open) close(false);
          else setOpen(true);
        }}
        onKeyDown={onBtnKey}
      >
        <span aria-hidden="true">{children}</span>
      </button>
      {open &&
        createPortal(
          <div
            ref={menuRef}
            id={menuId}
            role="menu"
            aria-label={label}
            className={cx(s.menu, menuClassName)}
            style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: 'hidden' }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={onMenuKey}
          >
            {shown.map((it, i) => (
              <button
                key={it.key || `${it.label}-${i}`}
                type="button"
                role="menuitem"
                tabIndex={-1}
                title={it.title}
                disabled={it.disabled}
                className={cx(s.item, it.danger && s.danger)}
                onClick={run(it)}
              >
                {it.label}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </>
  );
}
