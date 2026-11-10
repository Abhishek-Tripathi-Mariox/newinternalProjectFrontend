import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cx } from './cx';
import { buildItems, nextEnabled } from './selectItems';
import f from './Field.module.css';
import s from './Select.module.css';

const GAP = 4;
const EDGE = 8;
const MAX_H = 300;
const SEARCH_MIN = 8;

/** Event-like object so `onChange={(e) => e.target.value}` callers keep working. */
function changeEvent(value, name, id) {
  const target = { value, name: name ?? '', id: id ?? '' };
  return { target, currentTarget: target, type: 'change', preventDefault() {}, stopPropagation() {}, persist() {} };
}

const Chevron = () => (
  <svg className={s.chev} width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
    <path d="M3 4.5 6 7.5 9 4.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * Custom dropdown with the native <select> API.
 * - options: string[] | [{value, label, disabled?}]; `placeholder` adds a leading value="" item;
 *   <option>/<optgroup> children are appended.
 * - onChange gets `{ target: { value, name }, currentTarget }` (values are strings) — only when the value changes.
 * - `compact` / `inline` / `invalid` as before; `unstyled` drops the field look so `className` styles the trigger.
 * - Search box when there are more than 8 options, or `searchable` (false hides it).
 * - Creatable: `onCreate(label) => newValue | undefined` + `createLabel` ('Add source') add a sticky
 *   "+ Add …" footer; a returned string becomes the new value.
 */
export function Select({
  options = [],
  placeholder,
  invalid,
  compact,
  inline,
  unstyled,
  className,
  style,
  value,
  defaultValue,
  onChange,
  disabled,
  title,
  id,
  name,
  children,
  searchable,
  onCreate,
  createLabel = 'Add new',
  menuClassName,
  ref,
  onClick,
  onKeyDown,
  onBlur,
  ...rest
}) {
  const uid = useId();
  const listId = `${uid}-list`;
  const optId = (i) => `${uid}-o${i}`;
  const triggerRef = useRef(null);
  const popRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const typeRef = useRef({ buf: '', t: 0 });

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(-1);
  const [hint, setHint] = useState(false);
  const [pos, setPos] = useState(null);
  const [inner, setInner] = useState(defaultValue != null ? String(defaultValue) : undefined);

  const items = useMemo(() => buildItems(options, placeholder, children), [options, placeholder, children]);
  const optionCount = items.filter((it) => !it.group).length;
  const current = value !== undefined ? (value == null ? '' : String(value)) : inner;
  let selIdx = items.findIndex((it) => !it.group && it.value === current);
  // Like a native select: an unknown value shows the first enabled option.
  if (selIdx < 0) selIdx = nextEnabled(items, 0, 1);
  const selected = selIdx >= 0 ? items[selIdx] : null;

  const creatable = typeof onCreate === 'function';
  const showSearch = creatable || (searchable ?? optionCount > SEARCH_MIN);
  const q = query.trim().toLowerCase();
  const filtered = useMemo(
    () => (q ? items.filter((it) => !it.group && String(it.label).toLowerCase().includes(q)) : items),
    [items, q],
  );
  const exact = q ? items.find((it) => !it.group && String(it.label).toLowerCase() === q) : null;
  const nav = useMemo(() => (creatable ? [...filtered, { create: true }] : filtered), [filtered, creatable]);
  const isNavigable = (it) => it && !it.group && !it.disabled;

  /* ---------- open / close ---------- */
  const openMenu = useCallback(
    (seed) => {
      if (disabled) return;
      setQuery(typeof seed === 'string' && showSearch ? seed : '');
      setHint(false);
      setOpen(true);
    },
    [disabled, showSearch],
  );
  const close = useCallback((focusTrigger) => {
    setOpen(false);
    setQuery('');
    setHint(false);
    setPos(null);
    if (focusTrigger) triggerRef.current?.focus({ preventScroll: true });
  }, []);

  // Initial highlight: the selected item (or first enabled) whenever the menu opens / filter changes.
  useEffect(() => {
    if (!open) return;
    const sel = filtered.findIndex((it) => !it.group && it.value === current && !it.disabled);
    setActive(sel >= 0 && !q ? sel : nextEnabled(nav, 0, 1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, q]);

  // Focus the search box when it is shown.
  useEffect(() => {
    if (open && showSearch) searchRef.current?.focus({ preventScroll: true });
  }, [open, showSearch]);

  /* ---------- positioning ---------- */
  const place = useCallback(() => {
    const t = triggerRef.current;
    const p = popRef.current;
    if (!t || !p) return;
    const r = t.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const below = vh - r.bottom - GAP - EDGE;
    const above = r.top - GAP - EDGE;
    const l = listRef.current;
    const natural = l ? p.offsetHeight - l.clientHeight + Math.min(l.scrollHeight, MAX_H) : p.offsetHeight;
    const up = natural > below && above > below;
    const room = Math.max(120, up ? above : below);
    const width = Math.max(r.width, p.offsetWidth);
    const left = Math.max(EDGE, Math.min(r.left, vw - EDGE - width));
    setPos({
      left,
      minWidth: r.width,
      maxHeight: Math.min(room, MAX_H + 120),
      ...(up ? { bottom: vh - r.top + GAP } : { top: r.bottom + GAP }),
      up,
    });
  }, []);

  useLayoutEffect(() => {
    if (open) place();
  }, [open, place, nav.length, showSearch]);

  useEffect(() => {
    if (!open) return undefined;
    const onScroll = (e) => {
      if (popRef.current && popRef.current.contains(e.target)) return;
      place();
    };
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target) || popRef.current?.contains(e.target)) return;
      close(false);
    };
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', place);
    document.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', place);
      document.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, place, close]);

  // Keep the highlighted row visible.
  useEffect(() => {
    if (!open || active < 0) return;
    document.getElementById(optId(active))?.scrollIntoView({ block: 'nearest' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, open]);

  /* ---------- choosing ---------- */
  const commit = (v) => {
    const next = String(v);
    close(true);
    if (next === current) return;
    if (value === undefined) setInner(next);
    onChange?.(changeEvent(next, name, id));
  };

  const create = () => {
    const text = query.trim();
    if (!text) {
      setHint(true);
      searchRef.current?.focus();
      return;
    }
    if (exact) {
      if (!exact.disabled) commit(exact.value);
      return;
    }
    const made = onCreate(text);
    if (typeof made === 'string') {
      close(true);
      if (value === undefined) setInner(made);
      onChange?.(changeEvent(made, name, id));
    } else {
      // Creator may have opened a dialog etc. — close if focus moved elsewhere.
      setTimeout(() => {
        const a = document.activeElement;
        if (a && !popRef.current?.contains(a) && a !== triggerRef.current) close(false);
      }, 0);
    }
  };

  const choose = (i) => {
    const it = nav[i];
    if (!it) return;
    if (it.create) create();
    else if (isNavigable(it)) commit(it.value);
  };

  /* ---------- keyboard ---------- */
  const typeAhead = (ch) => {
    const tr = typeRef.current;
    const now = Date.now();
    tr.buf = now - tr.t > 600 ? ch : tr.buf + ch;
    tr.t = now;
    const buf = tr.buf.toLowerCase();
    const start = tr.buf.length === 1 ? active + 1 : Math.max(0, active);
    const order = [...nav.keys()].slice(start).concat([...nav.keys()].slice(0, start));
    const hit = order.find((i) => isNavigable(nav[i]) && String(nav[i].label).toLowerCase().startsWith(buf));
    if (hit != null) setActive(hit);
  };

  const handleKey = (e, fromSearch) => {
    const k = e.key;
    const stop = () => {
      e.preventDefault();
      e.stopPropagation();
    };
    if (!open) {
      if (k === 'ArrowDown' || k === 'ArrowUp' || k === 'Enter' || k === ' ') {
        stop();
        openMenu();
      } else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        stop();
        openMenu(k);
        if (!showSearch) typeAhead(k);
      }
      return;
    }
    switch (k) {
      case 'ArrowDown': {
        stop();
        const n = nextEnabled(nav, active + 1, 1);
        if (n >= 0) setActive(n);
        break;
      }
      case 'ArrowUp': {
        stop();
        if (e.altKey) return close(true);
        const n = nextEnabled(nav, active - 1, -1);
        if (n >= 0) setActive(n);
        break;
      }
      case 'Home':
      case 'PageUp':
        if (fromSearch && k === 'Home') return;
        stop();
        setActive(nextEnabled(nav, 0, 1));
        break;
      case 'End':
      case 'PageDown':
        if (fromSearch && k === 'End') return;
        stop();
        setActive(nextEnabled(nav, nav.length - 1, -1));
        break;
      case 'Enter':
        stop();
        if (active >= 0) choose(active);
        else if (creatable && query.trim()) create();
        break;
      case ' ':
        if (fromSearch) return;
        stop();
        if (active >= 0) choose(active);
        break;
      case 'Escape':
        stop();
        close(true);
        break;
      case 'Tab':
        // Return focus to the trigger; the browser's Tab then moves on from there.
        close(true);
        break;
      default:
        if (!fromSearch && k.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
          stop();
          typeAhead(k);
        }
    }
  };

  /* ---------- render ---------- */
  const isPlaceholder = !!selected?.placeholder;
  const setRef = (el) => {
    triggerRef.current = el;
    if (typeof ref === 'function') ref(el);
    else if (ref) ref.current = el;
  };
  const activeId = open && active >= 0 && nav[active] ? optId(active) : undefined;
  const createText = q && !exact ? `Add “${query.trim()}”` : createLabel;

  const menu =
    open &&
    createPortal(
      <div
        ref={popRef}
        className={cx(s.pop, pos?.up && s.up, menuClassName)}
        style={pos ? { left: pos.left, top: pos.top, bottom: pos.bottom, minWidth: pos.minWidth, maxHeight: pos.maxHeight } : { visibility: 'hidden', left: 0, top: 0 }}
        onMouseDown={(e) => {
          e.stopPropagation();
          if (e.target !== searchRef.current) e.preventDefault();
        }}
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        {showSearch && (
          <div className={s.searchRow}>
            <svg className={s.searchIcon} width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
              <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
              <path d="m11 11 3.5 3.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
            </svg>
            <input
              ref={searchRef}
              className={s.search}
              type="text"
              role="combobox"
              aria-expanded="true"
              aria-controls={listId}
              aria-autocomplete="list"
              aria-activedescendant={activeId}
              aria-label="Search options"
              autoComplete="off"
              spellCheck={false}
              placeholder={hint ? 'Type a name…' : creatable ? 'Search or add…' : 'Search…'}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setHint(false);
              }}
              onKeyDown={(e) => handleKey(e, true)}
            />
          </div>
        )}
        <div ref={listRef} id={listId} role="listbox" className={s.list} style={{ maxHeight: MAX_H }} aria-label={rest['aria-label'] || title}>
          {filtered.map((it, i) =>
            it.group != null ? (
              <div key={`g${i}`} className={s.group} role="presentation">
                {it.group}
              </div>
            ) : (
              <div
                key={`${it.value}\u0000${i}`}
                id={optId(i)}
                role="option"
                aria-selected={it === selected}
                aria-disabled={it.disabled || undefined}
                className={cx(s.opt, i === active && s.active, it === selected && s.selected, it.disabled && s.disabled, it.placeholder && s.ph)}
                onMouseMove={() => !it.disabled && active !== i && setActive(i)}
                onClick={() => choose(i)}
              >
                <span className={s.optLabel}>{it.label}</span>
                <span className={s.check} aria-hidden="true">{it === selected ? '✓' : ''}</span>
              </div>
            ),
          )}
          {!filtered.length && <div className={s.empty}>{creatable && q ? 'No matches' : 'No options'}</div>}
        </div>
        {creatable && (
          <div role="listbox" aria-label="Create" className={s.createWrap}>
          <div
            id={optId(nav.length - 1)}
            role="option"
            aria-selected="false"
            className={cx(s.create, active === nav.length - 1 && s.active)}
            onMouseMove={() => active !== nav.length - 1 && setActive(nav.length - 1)}
            onClick={() => choose(nav.length - 1)}
          >
            <span className={s.plus} aria-hidden="true">+</span>
            <span className={s.optLabel}>{createText}</span>
          </div>
          </div>
        )}
      </div>,
      document.body,
    );

  return (
    <>
      <button
        {...rest}
        ref={setRef}
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !showSearch ? activeId : undefined}
        aria-invalid={invalid || undefined}
        title={title}
        disabled={disabled}
        style={style}
        className={cx(
          s.trigger,
          !unstyled && f.control,
          !unstyled && s.field,
          compact && !unstyled && f.compact,
          inline && f.inline,
          invalid && f.invalid,
          open && s.open,
          className,
        )}
        onClick={(e) => {
          onClick?.(e);
          if (open) close(true);
          else openMenu();
        }}
        onKeyDown={(e) => {
          onKeyDown?.(e);
          if (!e.defaultPrevented) handleKey(e, false);
        }}
        onKeyUp={(e) => {
          // Space activates buttons on keyup — already handled on keydown.
          if (e.key === ' ') e.preventDefault();
        }}
        onBlur={onBlur}
      >
        <span className={cx(s.value, isPlaceholder && s.placeholder)}>
          <span className={s.cur}>{selected ? selected.label : ' '}</span>
          {items.length <= 80 &&
            items.map((it, i) =>
              it.group != null ? null : (
                <span key={i} className={s.ghost} aria-hidden="true">
                  {it.label}
                </span>
              ),
            )}
        </span>
        <Chevron />
      </button>
      {name != null && <input type="hidden" name={name} value={current ?? ''} />}
      {menu}
    </>
  );
}
