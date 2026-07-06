'use client';

import Link from 'next/link';
import { useState } from 'react';
import { copyToClipboard } from '@/lib/clipboard';
import { BotanicalSpray } from './BotanicalSpray';

const INSTALL_CMD = 'npm i @pothos/core';

export function Hero() {
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    const ok = await copyToClipboard(INSTALL_CMD);
    if (!ok) {
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <section className="max-w-[1280px] mx-auto px-10 pt-[88px] pb-20 relative">
      {/* Trailing pothos vines hanging from the header line. Shown at xl (not
          md): from 768 up to ~1279 the headline reflows to "…grow with your /
          code." and runs under the right-anchored vine, so the leaves crowd
          the word "your". Only at xl (1280+) does the text column leave clear
          space to the vine's left; below that the decorative vine is hidden. */}
      <div className="absolute top-0 right-10 hidden xl:block pointer-events-none text-bm-accent">
        <BotanicalSpray color="currentColor" />
      </div>
      {/* Eyebrow */}
      <div className="inline-flex items-center gap-2 mb-5 text-[12px] uppercase tracking-[0.08em] text-bm-ink-muted">
        <span className="w-[18px] h-px bg-bm-accent" aria-hidden="true" />
        Type-safe by design · v4.0
      </div>

      {/* H1 — clamps from a comfortable phone size up to the design's 88px */}
      <h1
        className="font-serif font-normal m-0"
        style={{
          fontSize: 'clamp(48px, 8vw, 88px)',
          lineHeight: 1.02,
          letterSpacing: '-0.035em',
          maxWidth: 980,
        }}
      >
        Schemas that{' '}
        <em
          className="italic text-bm-accent"
          // The Fraunces italic 'w' at opsz 144 overshoots its advance box on
          // the right; combined with the h1's -0.035em tracking it swallowed
          // the word-space so "grow" and "with" touched. A small right margin
          // restores a clear gap without adding literal whitespace.
          style={{ fontVariationSettings: '"opsz" 144', marginRight: '0.12em' }}
        >
          grow
        </em>{' '}
        with your code.
      </h1>

      {/* Lede */}
      <p
        className="text-bm-ink-soft mt-7 mb-9"
        style={{
          fontSize: 'clamp(17px, 2.4vw, 21px)',
          lineHeight: 1.5,
          maxWidth: 640,
          letterSpacing: '-0.01em',
        }}
      >
        Pothos is a plugin-based GraphQL schema builder for TypeScript. Zero runtime overhead, no
        codegen, end-to-end inference — at the scale of Airbnb, Netflix, and your weekend project.
      </p>

      {/* CTAs */}
      <div className="flex flex-wrap gap-3 items-center">
        <Link
          href="/docs"
          className="inline-flex items-center gap-2.5 rounded-lg text-[15px] font-medium px-6 py-3 bg-bm-ink text-bm-bg hover:opacity-90 transition-opacity"
        >
          Read the guide <span aria-hidden="true">→</span>
        </Link>
        <button
          type="button"
          onClick={onCopy}
          aria-label={copied ? 'Copied install command' : 'Copy install command'}
          title={copied ? 'Copied!' : 'Copy to clipboard'}
          className="inline-flex items-center gap-2.5 rounded-lg text-[14px] px-5 py-2.5 border border-bm-line text-bm-ink font-mono bg-transparent hover:bg-bm-surface-alt transition-colors cursor-pointer"
        >
          <code>{INSTALL_CMD}</code>
          <span className="text-bm-ink-muted ml-2.5" aria-hidden="true">
            {copied ? '✓' : '⧉'}
          </span>
        </button>
        <span className="text-[13px] text-bm-ink-muted ml-2">MIT · open source</span>
      </div>
    </section>
  );
}
