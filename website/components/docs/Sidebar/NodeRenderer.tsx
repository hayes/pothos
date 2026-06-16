'use client';

import type * as PageTree from 'fumadocs-core/page-tree';
import Link from 'next/link';
import { Fragment, useState } from 'react';
import { ChevronIcon } from '@/components/icons/ChevronIcon';
import { folderContainsPath, isActive, nodeKey } from './utils';

interface NodeProps {
  node: PageTree.Node;
  pathname: string;
  depth: number;
}

export function NodeRenderer({ node, pathname, depth }: NodeProps) {
  if (node.type === 'separator') {
    return <SeparatorRow node={node} />;
  }
  if (node.type === 'folder') {
    return <FolderRow node={node} pathname={pathname} depth={depth} />;
  }
  return <ItemRow node={node} active={isActive(node.url, pathname)} depth={depth} />;
}

function SeparatorRow({ node }: { node: PageTree.Separator }) {
  if (!node.name) {
    return <div className="h-2" aria-hidden="true" />;
  }
  return (
    <div className="text-[11px] uppercase tracking-[0.08em] text-bm-ink-muted px-2 pb-1 pt-2">
      {node.name}
    </div>
  );
}

function ItemRow({ node, active, depth }: { node: PageTree.Item; active: boolean; depth: number }) {
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

/**
 * Finds the first `PageTree.Item` we can navigate to inside a folder, walking
 * children depth-first. Used to give folder headers a sensible destination
 * when they lack an explicit `index` page — clicking "Guide" should land you
 * on the first guide page rather than doing nothing.
 */
function firstNavigableUrl(node: PageTree.Folder): string | undefined {
  for (const child of node.children) {
    if (child.type === 'page') return child.url;
    if (child.type === 'folder') {
      const inner = firstNavigableUrl(child);
      if (inner) return inner;
    }
  }
  return undefined;
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
  // Folders with no explicit index fall through to their first page so the
  // section header is always clickable. Without this, a flat-section layout
  // (separators inside a folder) leaves the section title as a dead label.
  const indexUrl = node.index?.url ?? firstNavigableUrl(node);
  const containsActive = folderContainsPath(node, pathname);
  const [expanded, setExpanded] = useState(containsActive || depth === 0);
  const indentPx = depth * 12;

  return (
    <div>
      <div className="flex items-center" style={{ paddingLeft: indentPx }}>
        {indexUrl ? (
          <Link
            href={indexUrl}
            // Clicking a folder header both navigates and opens the section. The
            // chevron button is for collapse-when-open, so we don't toggle here
            // — open if closed, no-op if already open. Avoids the surprising
            // behaviour where clicking "Prisma" snaps the section shut.
            onClick={() => {
              if (!expanded) setExpanded(true);
            }}
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
            <ChevronIcon open={expanded} />
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
