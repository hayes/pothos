'use client';

import type * as PageTree from 'fumadocs-core/page-tree';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { CollapseIcon } from '@/components/icons/CollapseIcon';
import { HamburgerIcon } from '@/components/icons/HamburgerIcon';
import { NodeRenderer } from './NodeRenderer';
import { SidebarFooter } from './SidebarFooter';
import { nodeKey } from './utils';

interface Props {
  tree: PageTree.Root;
}

const STORAGE_KEY = 'pothos-sidebar-collapsed';

/**
 * Custom docs sidebar that walks fumadocs's page-tree shape but renders
 * with the Botanical Modern vocabulary:
 *
 *   - 11px uppercase tracked section heads
 *   - 14px ink-soft item rows
 *   - 2px accent left-border on the active item, in `ink` weight
 *   - Nested folders indent and collapse
 *
 * Lives in its own scroll container — sticky to the
 * top-of-viewport-below-header, full remaining height — with a fixed
 * footer holding the theme toggle + GitHub + Sponsor links and a
 * collapse toggle.
 */
export function Sidebar({ tree }: Props) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const asideRef = useRef<HTMLElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);

  // Persist collapsed state per-device.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === '1') {
        setCollapsed(true);
      }
    } catch {}
  }, []);

  // Close the mobile drawer whenever the route changes. Without this the
  // drawer + backdrop stay mounted over the freshly-loaded page after a
  // sidebar link tap, and the `overflow: hidden` body scroll-lock (set by
  // the drawer effect below) never releases — leaving the page unreadable
  // until the user manually dismisses the drawer. Resetting `mobileOpen`
  // here triggers that effect's cleanup, which restores body scroll.
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally keyed on pathname to close on route change
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // On hard load / direct navigation, scroll the active item into view
  // inside the sidebar's own scroll container. Client-side navigation
  // already preserves scroll position, but a fresh load (shared link,
  // refresh, arrival from search) leaves the container pinned to the top
  // with the current page off-screen. We center the active row within the
  // nav rather than calling `scrollIntoView` so only the sidebar scrolls,
  // never the page. Runs once on mount — the tree is rendered synchronously.
  useEffect(() => {
    const nav = navRef.current;
    const active = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (!nav || !active) {
      return;
    }

    const navRect = nav.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();
    const offset = activeRect.top - navRect.top - nav.clientHeight / 2 + activeRect.height / 2;
    nav.scrollTop += offset;
  }, []);

  // Mobile drawer side-effects: Escape to close, body scroll lock, and
  // focus management. We pull all of these together so the open/closed
  // transition stays a single useEffect (avoid drift between handlers).
  useEffect(() => {
    if (!mobileOpen) {
      return;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setMobileOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Move focus into the drawer once it mounts — first focusable link.
    const firstLink = asideRef.current?.querySelector<HTMLAnchorElement>('nav a');
    firstLink?.focus();

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
      // Restore focus to the toggle button on close.
      openButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  const setAndPersist = (next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {}
  };

  return (
    <>
      {/* Mobile open trigger — sits below the header on narrow viewports */}
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open documentation menu"
        aria-expanded={mobileOpen}
        className="md:hidden fixed top-[80px] left-3 z-30 p-2 rounded border border-bm-line bg-bm-bg text-bm-ink-soft hover:text-bm-ink"
      >
        <HamburgerIcon />
      </button>

      {/* Backdrop for mobile */}
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="md:hidden fixed inset-0 z-30 bg-black/30 backdrop-blur-sm"
        />
      )}

      <aside
        ref={asideRef}
        aria-label="Documentation"
        className={`border-r border-bm-line bg-bm-bg sticky top-[72px] flex flex-col transition-[width] duration-200 z-40 ${
          mobileOpen ? 'fixed top-0 left-0 min-h-dvh w-[260px]' : 'hidden md:flex'
        } ${collapsed ? 'md:w-[56px]' : 'md:w-[260px]'}`}
        style={{ height: mobileOpen ? '100dvh' : 'calc(100vh - 72px)' }}
      >
        {/* When collapsed, show a single prominent expand button at the
            top so the rail is obviously re-openable — putting it at the
            top keeps it above floating UI like Next dev tools. */}
        {collapsed && (
          <div className="flex justify-center py-3 border-b border-bm-line">
            <button
              type="button"
              onClick={() => setAndPersist(false)}
              aria-label="Expand sidebar"
              title="Expand"
              className="inline-flex items-center justify-center size-8 rounded text-bm-ink-soft hover:text-bm-ink hover:bg-bm-surface-alt transition-colors"
            >
              <CollapseIcon collapsed />
            </button>
          </div>
        )}
        {!collapsed && (
          <nav
            ref={navRef}
            className="flex-1 min-h-0 overflow-y-auto py-6 px-4 flex flex-col gap-5"
          >
            {tree.children.map((node, i) => (
              <NodeRenderer key={nodeKey(node, i)} node={node} pathname={pathname} depth={0} />
            ))}
          </nav>
        )}
        {collapsed && <div className="flex-1" />}
        <SidebarFooter
          collapsed={collapsed}
          onToggleCollapsed={() => setAndPersist(!collapsed)}
          onCloseMobile={() => setMobileOpen(false)}
          isMobile={mobileOpen}
        />
      </aside>
    </>
  );
}
