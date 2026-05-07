'use client';

import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useEffect, useState } from 'react';
import { ThemeToggle } from '../marketing/ThemeToggle';

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

  // Persist collapsed state per-device.
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === '1') setCollapsed(true);
    } catch {}
  }, []);

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
        type="button"
        onClick={() => setMobileOpen(true)}
        aria-label="Open documentation menu"
        className="md:hidden fixed top-[80px] left-3 z-30 p-2 rounded border border-bm-line bg-bm-bg text-bm-ink-soft hover:text-bm-ink"
      >
        <MenuIcon />
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
        className={`border-r border-bm-line bg-bm-bg sticky top-[72px] flex flex-col transition-[width] duration-200 z-40 ${
          mobileOpen
            ? 'fixed top-0 left-0 h-screen w-[260px]'
            : 'hidden md:flex'
        } ${collapsed ? 'md:w-[56px]' : 'md:w-[260px]'}`}
        style={{ height: mobileOpen ? '100vh' : 'calc(100vh - 72px)' }}
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
          <nav className="flex-1 min-h-0 overflow-y-auto py-6 px-4 flex flex-col gap-5">
            {tree.children.map((node, i) => (
              <NodeRenderer
                key={nodeKey(node, i)}
                node={node}
                pathname={pathname}
                depth={0}
              />
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

function SidebarFooter({
  collapsed,
  onToggleCollapsed,
  onCloseMobile,
  isMobile,
}: {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onCloseMobile: () => void;
  isMobile: boolean;
}) {
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

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <line x1="4" y1="7" x2="20" y2="7" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="17" x2="20" y2="17" />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 .5C5.65.5.5 5.65.5 12c0 5.08 3.29 9.4 7.86 10.93.58.1.79-.25.79-.55v-2c-3.2.7-3.87-1.36-3.87-1.36-.52-1.32-1.27-1.67-1.27-1.67-1.04-.71.08-.7.08-.7 1.15.08 1.75 1.18 1.75 1.18 1.02 1.75 2.68 1.24 3.33.95.1-.74.4-1.24.72-1.53-2.55-.29-5.24-1.28-5.24-5.7 0-1.26.45-2.29 1.18-3.1-.12-.29-.51-1.46.11-3.04 0 0 .96-.31 3.16 1.18a11 11 0 0 1 5.75 0c2.2-1.49 3.16-1.18 3.16-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.41.36.78 1.05.78 2.13v3.16c0 .31.21.66.79.55C20.21 21.4 23.5 17.08 23.5 12 23.5 5.65 18.35.5 12 .5z" />
    </svg>
  );
}

function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ transform: collapsed ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 120ms' }}
    >
      <polyline points="9 3 5 7 9 11" />
    </svg>
  );
}

function nodeKey(node: PageTree.Node, i: number): string {
  if (node.type === 'page') return node.url;
  if (node.type === 'folder' && node.index?.url) return node.index.url;
  if (typeof node.name === 'string') return `${node.type}-${node.name}-${i}`;
  return `${node.type}-${i}`;
}

interface NodeProps {
  node: PageTree.Node;
  pathname: string;
  depth: number;
}

function NodeRenderer({ node, pathname, depth }: NodeProps) {
  if (node.type === 'separator') return <SeparatorRow node={node} />;
  if (node.type === 'folder') return <FolderRow node={node} pathname={pathname} depth={depth} />;
  return <ItemRow node={node} active={isActive(node.url, pathname)} depth={depth} />;
}

function SeparatorRow({ node }: { node: PageTree.Separator }) {
  if (!node.name) return <div className="h-2" aria-hidden="true" />;
  return (
    <div className="text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted px-2 pb-1 pt-2">
      {node.name}
    </div>
  );
}

function ItemRow({
  node,
  active,
  depth,
}: {
  node: PageTree.Item;
  active: boolean;
  depth: number;
}) {
  const indentPx = depth * 12;
  return (
    <Link
      href={node.url}
      target={node.external ? '_blank' : undefined}
      rel={node.external ? 'noreferrer' : undefined}
      className={`block py-1 text-[14px] border-l-2 transition-colors ${
        active
          ? 'text-bm-ink font-medium border-bm-accent'
          : 'text-bm-ink-soft hover:text-bm-ink border-transparent'
      }`}
      style={{ paddingLeft: 12 + indentPx }}
      aria-current={active ? 'page' : undefined}
    >
      {node.name}
    </Link>
  );
}

function FolderRow({
  node,
  pathname,
  depth,
}: {
  node: PageTree.Folder;
  pathname: string;
  depth: number;
}) {
  const indexUrl = node.index?.url;
  const containsActive = folderContainsPath(node, pathname);
  const [expanded, setExpanded] = useState(containsActive || depth === 0);
  const indentPx = depth * 12;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: indentPx }}>
        {indexUrl ? (
          <Link
            href={indexUrl}
            className={`flex-1 py-1 pl-3 text-[14px] border-l-2 transition-colors ${
              isActive(indexUrl, pathname)
                ? 'text-bm-ink font-medium border-bm-accent'
                : 'text-bm-ink-soft hover:text-bm-ink border-transparent'
            }`}
          >
            {node.name}
          </Link>
        ) : (
          <span className="flex-1 py-1 pl-3 text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted">
            {node.name}
          </span>
        )}
        {node.children.length > 0 && (
          <button
            type="button"
            onClick={() => setExpanded((s) => !s)}
            className="size-7 inline-flex items-center justify-center text-bm-ink-muted hover:text-bm-ink"
            aria-label={expanded ? 'Collapse' : 'Expand'}
            aria-expanded={expanded}
          >
            <Chevron open={expanded} />
          </button>
        )}
      </div>
      {expanded && (
        <div className="flex flex-col">
          {node.children.map((child, i) => (
            <Fragment key={nodeKey(child, i)}>
              <NodeRenderer node={child} pathname={pathname} depth={depth + 1} />
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
}

function isActive(url: string, pathname: string): boolean {
  return pathname === url;
}

function folderContainsPath(node: PageTree.Folder, pathname: string): boolean {
  if (node.index?.url && pathname.startsWith(node.index.url)) return true;
  for (const child of node.children) {
    if (child.type === 'page' && pathname === child.url) return true;
    if (child.type === 'folder' && folderContainsPath(child, pathname)) return true;
  }
  return false;
}

function Chevron({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{
        transform: open ? 'rotate(90deg)' : 'rotate(0deg)',
        transition: 'transform 120ms ease',
      }}
    >
      <polyline points="4 2.5 8 6 4 9.5" />
    </svg>
  );
}
