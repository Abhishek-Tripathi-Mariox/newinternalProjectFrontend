import { useStore } from '@/store';
import s from './Banners.module.css';

/** Transient flash message (store.flash → toast, cleared after 2.4 s by the store). */
export default function ToastHost() {
  const toast = useStore((x) => x.toast);
  return (
    <div role="status" aria-live="polite" aria-atomic="true" style={{ display: 'contents' }}>
      {toast ? <div className={s.toast}>{toast}</div> : null}
    </div>
  );
}
