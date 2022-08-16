export * from './connections';
export * from './global-ids';
export * from './resolve-nodes';

export function capitalize(s: string) {
  return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
