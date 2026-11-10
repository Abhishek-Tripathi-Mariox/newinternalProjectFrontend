import { useEffect, useRef } from 'react';

let locks = 0;

/** Lock body scroll while at least one dialog is open (ref-counted for nesting). */
function lockScroll() {
  locks += 1;
  if (locks === 1) document.body.classList.add('scroll-locked');
  return () => {
    locks = Math.max(0, locks - 1);
    if (locks === 0) document.body.classList.remove('scroll-locked');
  };
}

const FOCUSABLE =
  'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
const FIELD = 'input:not([type=hidden]):not([disabled]), select:not([disabled]), textarea:not([disabled]), [role=combobox]:not([disabled])';

/**
 * Shared dialog behaviour for Modal / Drawer:
 * - Escape closes (only the top-most dialog reacts)
 * - body scroll locked
 * - focus moves to the first form field (or the panel) and is restored on close
 * - Tab is trapped inside the panel
 */
export function useDialog(open, onClose) {
  const panelRef = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (!open) return undefined;
    const panel = panelRef.current;
    const prevFocus = document.activeElement;
    const unlock = lockScroll();

    const first = panel && (panel.querySelector('[data-autofocus]') || panel.querySelector(FIELD));
    (first || panel)?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (!panel) return;
      // Only the most recently opened dialog handles keys.
      const dialogs = document.querySelectorAll('[data-dialog-panel]');
      if (dialogs[dialogs.length - 1] !== panel) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current?.();
      } else if (e.key === 'Tab') {
        const items = [...panel.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      unlock();
      if (prevFocus && typeof prevFocus.focus === 'function' && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
    };
  }, [open]);

  /** Backdrop handler: close only when the press both started and ended on the backdrop. */
  const downOnBackdrop = useRef(false);
  const backdropProps = {
    onMouseDown: (e) => {
      downOnBackdrop.current = e.target === e.currentTarget;
    },
    onClick: (e) => {
      if (downOnBackdrop.current && e.target === e.currentTarget) closeRef.current?.();
      downOnBackdrop.current = false;
    },
  };

  return { panelRef, backdropProps };
}
