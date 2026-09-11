'use client';

import dynamic from 'next/dynamic';
import { type ReactNode, useSyncExternalStore } from 'react';

const LandingPlayground = dynamic(
  () => import('./LandingPlayground').then((module) => module.LandingPlayground),
  { ssr: false },
);

function subscribe(onChange: () => void) {
  const query = window.matchMedia('(min-width: 768px)');
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}

export function ResponsivePlayground({ children }: { children: ReactNode }) {
  const desktop = useSyncExternalStore(
    subscribe,
    () => window.matchMedia('(min-width: 768px)').matches,
    () => false,
  );
  return desktop ? <LandingPlayground /> : children;
}
