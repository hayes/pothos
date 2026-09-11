import type * as PageTree from 'fumadocs-core/page-tree';

export function nodeKey(node: PageTree.Node, i: number): string {
  if (node.type === 'page') {
    return node.url;
  }
  if (node.type === 'folder' && node.index?.url) {
    return node.index.url;
  }
  if (typeof node.name === 'string') {
    return `${node.type}-${node.name}-${i}`;
  }
  return `${node.type}-${i}`;
}

export function isActive(url: string, pathname: string): boolean {
  return pathname === url;
}

export function folderContainsPath(node: PageTree.Folder, pathname: string): boolean {
  if (node.index?.url && pathname.startsWith(node.index.url)) {
    return true;
  }
  for (const child of node.children) {
    if (child.type === 'page' && pathname === child.url) {
      return true;
    }
    if (child.type === 'folder' && folderContainsPath(child, pathname)) {
      return true;
    }
  }
  return false;
}
