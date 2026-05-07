'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { ThemeToggle } from '../../marketing/ThemeToggle';
import { Wordmark } from '../../marketing/Wordmark';
import { Button } from '../shell/Button';
import { type OverflowItem, OverflowMenu } from './OverflowMenu';
import { RunButton } from './RunButton';
import { SketchName } from './SketchName';
import { type SchemaStatus, StatusPill } from './StatusPill';

interface Props {
  /**
   * Embedded mode (rendered inside an iframe in the docs). Hides the
   * "Load example" picker and the editable sketch name, and keeps the
   * Wordmark from navigating the iframe back to the home page.
   */
  embed?: boolean;

  sketchName: string;
  onSketchRename: (next: string) => void;

  status: SchemaStatus;

  consoleCount: number;
  consoleHasErrors: boolean;
  consoleOpen: boolean;
  onToggleConsole: () => void;

  onShare: () => void;
  shareLabel: string;

  running: boolean;
  onRun: () => void;

  examplesOpen: boolean;
  onToggleExamples: () => void;
  examplesPicker?: ReactNode;

  overflowOpen: boolean;
  onToggleOverflow: () => void;
  overflowItems: OverflowItem[];
}

export function Toolbar({
  embed = false,
  sketchName,
  onSketchRename,
  status,
  consoleCount,
  consoleHasErrors,
  consoleOpen,
  onToggleConsole,
  onShare,
  shareLabel,
  running,
  onRun,
  examplesOpen,
  onToggleExamples,
  examplesPicker,
  overflowOpen,
  onToggleOverflow,
  overflowItems,
}: Props) {
  // In the standalone /playground route, the Wordmark links home. In an
  // embed iframe, that would navigate the iframe to the marketing page,
  // which is jarring; we open in a new tab and break out of the frame
  // instead so it behaves as "view in full app".
  const wordmark = <Wordmark width={104} height={24} />;
  const wordmarkSlot = embed ? (
    <a
      href="/playground"
      target="_blank"
      rel="noopener noreferrer"
      title="Open Pothos Playground in a new tab"
      aria-label="Pothos"
      className="flex items-center hover:opacity-90 transition-opacity"
    >
      {wordmark}
    </a>
  ) : (
    <Link
      href="/"
      title="Back to Pothos"
      aria-label="Pothos"
      className="flex items-center hover:opacity-90 transition-opacity"
    >
      {wordmark}
    </Link>
  );

  return (
    <div className="relative z-[5] flex items-center gap-3.5 px-6 py-3 bg-bm-bg border-b border-bm-line">
      {wordmarkSlot}
      <span className="h-5 w-px bg-bm-line" aria-hidden="true" />
      <div className="flex items-baseline gap-2.5">
        <span className="font-serif text-[18px] font-normal tracking-[-0.01em] text-bm-ink">
          Playground
        </span>
        {/* In embed mode the sketch is read-only — show the loaded
            example's title (or nothing if no example). In standalone
            mode the user can rename, but skip the input when there's
            no name yet so we don't render an empty button. */}
        {embed
          ? sketchName && (
              <span className="font-serif text-[13px] italic text-bm-ink-muted">
                {sketchName}
              </span>
            )
          : sketchName && <SketchName value={sketchName} onChange={onSketchRename} />}
      </div>

      {!embed && (
        <div className="relative">
          <button
            type="button"
            onClick={onToggleExamples}
            className={`inline-flex items-center gap-1.5 rounded text-[13px] cursor-pointer px-3.5 py-1.5 font-medium transition-colors ${
              examplesOpen
                ? 'bg-bm-accent text-bm-bg'
                : 'bg-bm-accent-soft text-bm-accent-ink border border-bm-accent/40 hover:bg-bm-accent hover:text-bm-bg'
            }`}
          >
            <span>＋ Load example</span>
            <span className="text-[10px] opacity-70">▾</span>
          </button>
          {examplesPicker}
        </div>
      )}

      <div className="flex-1" />

      <StatusPill status={status} />

      <Button variant="ghost" active={consoleOpen} onClick={onToggleConsole}>
        Console
        <span
          className={`rounded-full text-[10px] font-semibold leading-none px-1.5 min-w-[14px] text-center text-bm-bg ${
            consoleHasErrors ? 'bg-bm-danger' : 'bg-bm-ink-muted'
          }`}
          style={{ paddingTop: 2, paddingBottom: 2 }}
        >
          {consoleCount}
        </span>
      </Button>

      <Button variant="ghost" onClick={onShare}>
        {shareLabel}
      </Button>

      <RunButton running={running} onRun={onRun} />

      <ThemeToggle className="size-7" />

      <div className="relative">
        <button
          type="button"
          onClick={onToggleOverflow}
          aria-label="More"
          className="p-1 text-bm-ink-soft hover:text-bm-ink text-[18px] leading-none cursor-pointer"
        >
          ⋯
        </button>
        <OverflowMenu open={overflowOpen} onClose={onToggleOverflow} items={overflowItems} />
      </div>
    </div>
  );
}
