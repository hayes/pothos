'use client';

import { CollapseIcon } from '@/components/icons/CollapseIcon';
import { GitHubIcon } from '@/components/icons/GitHubIcon';
import { ThemeToggle } from '@/components/marketing/ThemeToggle';

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  isMobile: boolean;
}

export function SidebarFooter({ collapsed, onToggleCollapsed, onCloseMobile, isMobile }: Props) {
  return (
    <footer
      className={`flex items-center gap-1 px-3 py-3 border-t border-bm-line bg-bm-bg ${
        collapsed ? 'flex-col gap-2' : ''
      }`}
    >
      <ThemeToggle className="size-8" />
      <a
        href="https://github.com/hayes/pothos"
        target="_blank"
        rel="noreferrer"
        className="inline-flex items-center justify-center size-8 rounded text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors"
        aria-label="GitHub repository"
        title="GitHub"
      >
        <GitHubIcon />
      </a>
      {!collapsed && (
        <>
          <div className="flex-1" />
          <a
            href="https://github.com/sponsors/hayes"
            target="_blank"
            rel="noreferrer"
            className="text-[12px] text-bm-ink-muted hover:text-bm-ink transition-colors"
          >
            Sponsor →
          </a>
        </>
      )}
      {isMobile && (
        <button
          type="button"
          onClick={onCloseMobile}
          aria-label="Close menu"
          className="ml-auto p-1 text-bm-ink-muted hover:text-bm-ink"
        >
          ×
        </button>
      )}
      {!collapsed && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          aria-label="Collapse sidebar"
          title="Collapse"
          className="hidden md:inline-flex items-center justify-center size-8 rounded text-bm-ink-muted hover:text-bm-ink hover:bg-bm-surface-alt transition-colors"
        >
          <CollapseIcon collapsed={false} />
        </button>
      )}
    </footer>
  );
}
