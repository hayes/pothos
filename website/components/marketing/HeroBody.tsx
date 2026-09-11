'use client';

import dynamic from 'next/dynamic';

const LandingPlayground = dynamic(
  () => import('./LandingPlayground').then((module) => module.LandingPlayground),
  {
    ssr: false,
    loading: () => (
      <div className="h-[640px] rounded-xl border border-bm-line p-6 text-bm-ink-muted">
        Loading playground…
      </div>
    ),
  },
);

export function HeroBody() {
  return (
    <section className="max-w-[1280px] mx-auto px-6 sm:px-10 pb-24">
      <LandingPlayground />
    </section>
  );
}
