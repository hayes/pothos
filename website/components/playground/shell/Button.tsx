'use client';

import type { ButtonHTMLAttributes, ReactNode } from 'react';

type Variant = 'primary' | 'ghost' | 'icon';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  active?: boolean;
  children?: ReactNode;
}

const baseClass =
  'inline-flex items-center gap-1.5 rounded text-[13px] cursor-pointer disabled:cursor-not-allowed transition-[background,color,border-color] duration-100';

const variantClass: Record<Variant, string> = {
  primary:
    'px-3.5 py-1.5 font-medium tracking-[0.01em] bg-bm-ink text-bm-bg hover:opacity-90 disabled:bg-bm-surface-alt disabled:text-bm-ink-muted disabled:border disabled:border-bm-line',
  ghost:
    'px-3 py-1.5 text-bm-ink-soft border border-bm-line bg-transparent hover:bg-bm-surface-alt hover:text-bm-ink',
  icon: 'p-1 text-bm-ink-soft hover:text-bm-ink bg-transparent',
};

export function Button({ variant = 'ghost', active, className = '', children, ...rest }: Props) {
  const activeClass = active ? 'bg-bm-surface-alt text-bm-ink' : '';
  return (
    <button
      type="button"
      {...rest}
      className={`${baseClass} ${variantClass[variant]} ${activeClass} ${className}`}
    >
      {children}
    </button>
  );
}
