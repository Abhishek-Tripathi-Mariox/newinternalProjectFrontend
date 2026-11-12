import { useEffect, useState } from 'react';
import { serverNow } from '@/lib/clock';

/** Current time (ms), re-rendering every `intervalMs` (default 15s, like the original live refresh). */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const iv = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}
