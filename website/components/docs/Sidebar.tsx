'use client';

import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Fragment, useState } from 'react';

interface Props {
  tree: PageTree.Root;
}

/**
 * Custom docs sidebar that walks fumadocs's page-tree shape but renders
 * with the Botanical Modern vocabulary:
 *
 *   - 11px uppercase tracked section heads
 *   - 14px ink-soft item rows
 *   - 2px accent left-border on the active item, in `ink` weight
 *   - Nested folders indent and collapse
 */
export function Sidebar({ tree }: Props) {
  const pathname = usePathname();
  return (
    <aside className="border-r border-bm-line bg-bm-bg overflow-y-auto py-6 px-4 min-h-0 w-[260px]">
      <nav className="flex flex-col gap-5">
        {tree.children.map((node, i) => (
          <NodeRenderer key={nodeKey(node, i)} node={node} pathname={pathname} depth={0} />
        ))}
      </nav>
    </aside>
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
        {/* Folder label is itself a link if it has an index page */}
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
