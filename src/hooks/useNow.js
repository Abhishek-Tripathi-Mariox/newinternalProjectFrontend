import { useEffect, useState } from 'react';

/** Current time (ms), re-rendering every `intervalMs` (default 15s, like the original live refresh). */
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const iv = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(iv);
  }, [intervalMs]);
  return now;
}
