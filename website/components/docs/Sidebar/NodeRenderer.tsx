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
