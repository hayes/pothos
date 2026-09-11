'use client';

import { Fragment } from 'react';
import type { Step } from '../examples';

interface Props {
  exampleTitle: string;
  steps: Step[];
  index: number;
  /** Step the user just clicked but whose bundle is still loading.
   *  Renders a spinner on that step's circle and disables clicks on
   *  the whole bar until the load resolves. */
  pendingIndex: number | null;
  onSelect: (index: number) => void;
  onExit: () => void;
}

/**
 * Horizontal numbered-circle stepper, shown between toolbar and body
 * when a multi-step example is loaded.
 */
export function StepperBar({ exampleTitle, steps, index, pendingIndex, onSelect, onExit }: Props) {
  const total = steps.length;
  const clamped = Math.min(Math.max(0, index), total - 1);
  const isPending = pendingIndex !== null;
  // While a step is loading, prev/next jump from the pending target so
  // a fast double-click advances through the bundle queue smoothly.
  const baseline = pendingIndex ?? clamped;
  const prev = () => onSelect(Math.max(0, baseline - 1));
  const next = () => onSelect(Math.min(total - 1, baseline + 1));

  return (
    <div
      className="flex items-center gap-3.5 px-6 py-2.5 bg-bm-accent-soft/20 border-b border-bm-line overflow-x-auto"
      aria-busy={isPending}
    >
      <div className="flex items-baseline gap-2 font-serif shrink-0">
        <span className="text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted">Example</span>
        <span className="text-[14px] italic text-bm-ink">{exampleTitle}</span>
      </div>

      <div className="flex-1 flex items-center ml-4 min-w-0">
        {steps.map((step, i) => {
          const isCurrent = i === clamped;
          const isPendingThis = pendingIndex === i;
          // While loading, dim non-pending rows so the eye lands on
          // the one that's about to become active.
          const dimmed = isPending && !isPendingThis;
          return (
            <Fragment key={step.id}>
              <button
                type="button"
                onClick={() => onSelect(i)}
                aria-current={isCurrent ? 'step' : undefined}
                aria-busy={isPendingThis}
                disabled={isPending}
                className={`flex items-center gap-2 px-2 py-1 shrink-0 transition-opacity ${
                  isPending ? 'cursor-progress' : 'hover:opacity-90'
                } ${dimmed ? 'opacity-40' : ''}`}
                title={step.description}
              >
                <StepCircle
                  state={
                    isPendingThis
                      ? 'pending'
                      : isCurrent
                        ? 'current'
                        : i < clamped
                          ? 'done'
                          : 'upcoming'
                  }
                >
                  {isPendingThis ? <Spinner /> : i < clamped ? '✓' : i + 1}
                </StepCircle>
                <span
                  className={`text-[12px] whitespace-nowrap ${
                    isCurrent || isPendingThis ? 'text-bm-ink font-medium' : 'text-bm-ink-muted'
                  }`}
                >
                  {step.title}
                </span>
              </button>
              {i < total - 1 && (
                <span className="flex-1 h-px bg-bm-line min-w-3 max-w-10" aria-hidden="true" />
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        <span className="font-mono text-[11px] text-bm-ink-muted mr-2">
          {clamped + 1} / {total}
        </span>
        <button
          type="button"
          onClick={prev}
          disabled={baseline === 0 || isPending}
          className="rounded text-[12px] px-2.5 py-1 border border-bm-line bg-transparent text-bm-ink-soft hover:bg-bm-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={next}
          disabled={baseline === total - 1 || isPending}
          className="rounded text-[12px] px-3 py-1 font-medium bg-bm-ink text-bm-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-bm-ink-muted disabled:border disabled:border-bm-line"
        >
          Next →
        </button>
        <button
          type="button"
          onClick={onExit}
          title="Exit example"
          aria-label="Exit example"
          disabled={isPending}
          className="ml-1 px-2 py-1 text-[16px] text-bm-ink-muted hover:text-bm-ink disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      width="11"
      height="11"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" strokeLinecap="round" />
    </svg>
  );
}

function StepCircle({
  state,
  children,
}: {
  state: 'current' | 'done' | 'upcoming' | 'pending';
  children: React.ReactNode;
}) {
  const cls =
    state === 'current'
      ? 'bg-bm-accent border-bm-accent text-bm-bg'
      : state === 'pending'
        ? 'bg-bm-accent/70 border-bm-accent text-bm-bg'
        : state === 'done'
          ? 'bg-bm-surface-alt border-bm-line text-bm-ink-soft'
          : 'bg-transparent border-bm-line text-bm-ink-soft';

  return (
    <span
      className={`inline-flex items-center justify-center size-[22px] rounded-full border text-[11px] font-medium tabular-nums ${cls}`}
    >
      {children}
    </span>
  );
}
