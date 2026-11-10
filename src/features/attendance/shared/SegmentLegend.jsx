import s from './shared.module.css';

/** "■ Working ■ Break  <hint>" legend under the attendance bars. */
export default function SegmentLegend({ work, brk, hint, swatch = 'bar', className }) {
  const sw = swatch === 'square' ? s.swatchSquare : s.swatchBar;
  return (
    <div className={`${s.legend} ${className || ''}`}>
      <span className={s.legendItem}><span className={sw} style={{ background: work }} />Working</span>
      <span className={s.legendItem}><span className={sw} style={{ background: brk }} />Break</span>
      {hint ? <span>{hint}</span> : null}
    </div>
  );
}
