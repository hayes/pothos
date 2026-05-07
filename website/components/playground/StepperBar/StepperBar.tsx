'use client';

import { Fragment } from 'react';
import type { Step } from '../examples';

interface Props {
  exampleTitle: string;
  steps: Step[];
  index: number;
  onSelect: (index: number) => void;
  onExit: () => void;
}

/**
 * Horizontal numbered-circle stepper, shown between toolbar and body
 * when a multi-step example is loaded.
 */
export function StepperBar({ exampleTitle, steps, index, onSelect, onExit }: Props) {
  const total = steps.length;
  const clamped = Math.min(Math.max(0, index), total - 1);
  const prev = () => onSelect(Math.max(0, clamped - 1));
  const next = () => onSelect(Math.min(total - 1, clamped + 1));

  return (
    <div className="flex items-center gap-3.5 px-6 py-2.5 bg-bm-accent-soft/20 border-b border-bm-line">
      <div className="flex items-baseline gap-2 font-serif">
        <span className="text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted">Example</span>
        <span className="text-[14px] italic text-bm-ink">{exampleTitle}</span>
      </div>

      <div className="flex-1 flex items-center ml-4">
        {steps.map((step, i) => (
          <Fragment key={step.id}>
            <button
              type="button"
              onClick={() => onSelect(i)}
              className="flex items-center gap-2 px-2 py-1 hover:opacity-90"
              title={step.description}
            >
              <StepCircle state={i === clamped ? 'current' : i < clamped ? 'done' : 'upcoming'}>
                {i < clamped ? '✓' : i + 1}
              </StepCircle>
              <span
                className={`text-[12px] whitespace-nowrap ${
                  i === clamped ? 'text-bm-ink font-medium' : 'text-bm-ink-muted'
                }`}
              >
                {step.title}
              </span>
            </button>
            {i < total - 1 && (
              <span className="flex-1 h-px bg-bm-line min-w-3 max-w-10" aria-hidden="true" />
            )}
          </Fragment>
        ))}
      </div>

      <div className="flex items-center gap-1.5">
        <span className="font-mono text-[11px] text-bm-ink-muted mr-2">
          {clamped + 1} / {total}
        </span>
        <button
          type="button"
          onClick={prev}
          disabled={clamped === 0}
          className="rounded text-[12px] px-2.5 py-1 border border-bm-line bg-transparent text-bm-ink-soft hover:bg-bm-surface-alt disabled:opacity-50 disabled:cursor-not-allowed"
        >
          ← Prev
        </button>
        <button
          type="button"
          onClick={next}
          disabled={clamped === total - 1}
          className="rounded text-[12px] px-3 py-1 font-medium bg-bm-ink text-bm-bg hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-transparent disabled:text-bm-ink-muted disabled:border disabled:border-bm-line"
        >
          Next →
        </button>
        <button
          type="button"
          onClick={onExit}
          title="Exit example"
          className="ml-1 px-2 py-1 text-[16px] text-bm-ink-muted hover:text-bm-ink"
        >
          ×
        </button>
      </div>
    </div>
  );
}

function StepCircle({
  state,
  children,
}: {
  state: 'current' | 'done' | 'upcoming';
  children: React.ReactNode;
}) {
  const cls =
    state === 'current'
      ? 'bg-bm-accent border-bm-accent text-bm-bg'
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
