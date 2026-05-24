import { useEffect } from 'react';

// Calls `onEscape` whenever the user presses Escape while the
// component is mounted. Handy for closing modals via keyboard —
// WCAG 2.2 / 2.4.7 mandates a visible, predictable way out.
export function useEscapeKey(onEscape, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onEscape?.();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onEscape, enabled]);
}
