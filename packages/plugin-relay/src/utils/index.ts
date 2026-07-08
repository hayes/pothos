export * from './connections.js';
export * from './global-ids.js';
export * from './resolve-nodes.js';

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
