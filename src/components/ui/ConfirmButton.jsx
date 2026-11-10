import { useEffect, useState } from 'react';
import { Button } from './Button';

/**
 * Two-step destructive button: first click arms it (label → `confirmLabel`), a second click
 * within 4 s calls onConfirm. Other props go to Button (default variant 'dangerOutline').
 */
export function ConfirmButton({ onConfirm, children, confirmLabel = 'Click again to confirm', variant = 'dangerOutline', timeout = 4000, ...rest }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), timeout);
    return () => clearTimeout(t);
  }, [armed, timeout]);
  return (
    <Button
      variant={armed ? 'danger' : variant}
      aria-live="polite"
      onClick={(e) => {
        e.stopPropagation();
        if (armed) {
          setArmed(false);
          onConfirm?.(e);
        } else setArmed(true);
      }}
      {...rest}
    >
      {armed ? confirmLabel : children}
    </Button>
  );
}
