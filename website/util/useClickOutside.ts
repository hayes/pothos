import { RefObject, useEffect } from 'react';
import useEscape from './useEscape';

export function useClickOutside(ref: RefObject<HTMLElement | null>, handler: () => void) {
  useEffect(() => {
    const listener = (ev: MouseEvent | TouchEvent) => {
      if (!ref.current || ref.current.contains(ev.target as HTMLElement)) {
        return;
      }

      handler();
    };

    document.addEventListener('mousedown', listener);
    document.addEventListener('touchstart', listener);

    return () => {
      document.removeEventListener('mousedown', listener);
      document.removeEventListener('touchstart', listener);
    };
  }, [ref, handler]);

  useEscape(handler);
}
