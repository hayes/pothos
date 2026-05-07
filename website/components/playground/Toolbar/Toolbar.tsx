'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { HeartLeaf } from '../../marketing/HeartLeaf';
import { ThemeToggle } from '../../marketing/ThemeToggle';
import { Button } from '../shell/Button';
import { type OverflowItem, OverflowMenu } from './OverflowMenu';
import { RunButton } from './RunButton';
import { SketchName } from './SketchName';
import { type SchemaStatus, StatusPill } from './StatusPill';

interface Props {
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
  return (
    <div className="relative z-[5] flex items-center gap-3.5 px-6 py-3 bg-bm-bg border-b border-bm-line">
      <Link
        href="/"
        title="Back to Pothos"
        className="flex items-center gap-2 text-bm-ink hover:opacity-90 transition-opacity"
      >
        <HeartLeaf size={20} fill="var(--bm-accent)" stroke="none" veins />
        <span className="font-serif text-[18px] tracking-[-0.01em]">Pothos</span>
      </Link>
      <span className="h-5 w-px bg-bm-line" aria-hidden="true" />
      <div className="flex items-baseline gap-2.5">
        <span className="font-serif text-[18px] font-normal tracking-[-0.01em] text-bm-ink">
          Playground
        </span>
        <SketchName value={sketchName} onChange={onSketchRename} />
      </div>

      <div className="relative">
        <Button variant="ghost" active={examplesOpen} onClick={onToggleExamples}>
          <span>Load example</span>
          <span className="text-[10px] text-bm-ink-muted">▾</span>
        </Button>
        {examplesPicker}
      </div>

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
