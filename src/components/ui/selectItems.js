import { Children, Fragment, isValidElement } from 'react';

/** Plain text of React children (strings / numbers / nested elements). */
export function textOf(node) {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textOf).join('');
  if (isValidElement(node)) return textOf(node.props.children);
  return '';
}

const norm = (o) =>
  typeof o === 'object' && o !== null
    ? { value: String(o.value ?? ''), label: o.label ?? String(o.value ?? ''), disabled: !!o.disabled }
    : { value: String(o ?? ''), label: String(o ?? ''), disabled: false };

/** Flatten <option> / <optgroup> / fragment children into items (group headers have `group`). */
function fromChildren(children, out, inGroup) {
  Children.forEach(children, (ch) => {
    if (!isValidElement(ch)) return;
    if (ch.type === Fragment) {
      fromChildren(ch.props.children, out, inGroup);
    } else if (ch.type === 'option') {
      const label = textOf(ch.props.children) || ch.props.label || '';
      out.push({ value: String(ch.props.value ?? label), label, disabled: !!(ch.props.disabled || inGroup?.disabled) });
    } else if (ch.type === 'optgroup') {
      out.push({ group: ch.props.label ?? '' });
      fromChildren(ch.props.children, out, { disabled: !!ch.props.disabled });
    }
  });
}

/**
 * Build the item list a Select shows: placeholder (value ""), `options`, then any
 * <option>/<optgroup> children — same order a native <select> would render them.
 */
export function buildItems(options, placeholder, children) {
  const out = [];
  if (placeholder != null) out.push({ value: '', label: placeholder, disabled: false, placeholder: true });
  for (const o of options || []) out.push(norm(o));
  if (children) fromChildren(children, out, null);
  return out;
}

/** Index of the next enabled, non-header item from `from` in direction `dir` (no wrap). */
export function nextEnabled(list, from, dir) {
  for (let i = from; i >= 0 && i < list.length; i += dir) {
    const it = list[i];
    if (it && !it.group && !it.disabled) return i;
  }
  return -1;
}
