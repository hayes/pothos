import { useEffect } from 'react';

export default function useEscape(handler: () => void) {
  useEffect(() => {
    function listener(ev: KeyboardEvent) {
      if (ev.key === 'Escape') {
        handler();
      }
    }

    window.addEventListener('keyup', listener);

    return () => void window.removeEventListener('keyup', listener);
  }, []);
}
