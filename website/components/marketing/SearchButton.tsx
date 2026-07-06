'use client';

import { useSearchContext } from 'fumadocs-ui/contexts/search';
import { SearchIcon } from '@/components/icons/SearchIcon';

interface SearchButtonProps {
  /**
   * `full` — the labelled desktop pill with the ⌘K / Ctrl+K hint.
   * `icon` — a compact icon-only trigger for the mobile header.
   * `block` — a full-width row for the mobile nav drawer.
   */
  variant?: 'full' | 'icon' | 'block';
  onActivate?: () => void;
}

/**
 * Header search trigger. Opens the fumadocs search dialog via the shared
 * search context (also reachable with Cmd/Ctrl+K). Styled with the
 * Botanical Modern `bm-*` tokens to match the neighbouring GitHub button.
 */
export function SearchButton({ variant = 'full', onActivate }: SearchButtonProps) {
  const { setOpenSearch, hotKey } = useSearchContext();

  const open = () => {
    onActivate?.();
    setOpenSearch(true);
  };

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={open}
        aria-label="Search documentation"
        className="sm:hidden inline-flex items-center justify-center size-9 rounded text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors"
      >
        <SearchIcon className="size-[18px]" />
      </button>
    );
  }

  if (variant === 'block') {
    return (
      <button
        type="button"
        onClick={open}
        className="flex w-full items-center gap-2 py-2 text-[15px] text-bm-ink-soft hover:text-bm-ink transition-colors"
      >
        <SearchIcon className="size-4" />
        <span>Search docs</span>
        <span className="ml-auto inline-flex gap-0.5">
          {hotKey.map((k, i) => (
            <kbd
              // biome-ignore lint/suspicious/noArrayIndexKey: static hotkey list
              key={i}
              className="rounded border border-bm-line bg-bm-surface-alt px-1.5 font-mono text-[11px] text-bm-ink-muted"
            >
              {k.display}
            </kbd>
          ))}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={open}
      className="hidden sm:inline-flex items-center gap-2 text-[13px] text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors ps-2.5 pe-1.5 py-1.5 border border-bm-line rounded"
    >
      <SearchIcon className="size-4" />
      <span className="text-[13px]">Search</span>
      <span className="inline-flex gap-0.5">
        {hotKey.map((k, i) => (
          <kbd
            // biome-ignore lint/suspicious/noArrayIndexKey: static hotkey list
            key={i}
            className="rounded border border-bm-line bg-bm-surface-alt px-1.5 font-mono text-[11px] leading-[1.4] text-bm-ink-muted"
          >
            {k.display}
          </kbd>
        ))}
      </span>
    </button>
  );
}
