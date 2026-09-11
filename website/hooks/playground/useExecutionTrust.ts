'use client';

import { useEffect, useRef, useState } from 'react';
import { readInitialFromURL } from './useUrlSync';

/** Keep shared code paused until the user explicitly trusts this page load. */
export function useExecutionTrust() {
  // Match server and client rendering, and do not start compiling until URL
  // bootstrap and this mount effect have established which files are loaded.
  const [executionAllowed, setExecutionAllowed] = useState(false);
  const executionAllowedRef = useRef(false);
  const initialExecutionAllowedRef = useRef<boolean | null>(null);
  useEffect(() => {
    // StrictMode replays mount effects after URL synchronization may already
    // have rewritten the hash. Keep the decision for the original payload.
    if (initialExecutionAllowedRef.current === null) {
      initialExecutionAllowedRef.current = readInitialFromURL() === null;
    }
    const allowed = initialExecutionAllowedRef.current;
    executionAllowedRef.current = allowed;
    setExecutionAllowed(allowed);
    // A newly navigated sketch gets a fresh bootstrap and trust decision.
    // replaceState used for editor synchronization does not emit hashchange.
    const navigate = () => {
      executionAllowedRef.current = false;
      setExecutionAllowed(false);
      window.location.reload();
    };
    window.addEventListener('hashchange', navigate);
    return () => window.removeEventListener('hashchange', navigate);
  }, []);

  return {
    executionAllowed,
    executionAllowedRef,
    allowExecution: () => {
      executionAllowedRef.current = true;
      setExecutionAllowed(true);
    },
  };
}
