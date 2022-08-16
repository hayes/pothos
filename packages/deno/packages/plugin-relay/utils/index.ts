// @ts-nocheck
export * from './connections.ts';
export * from './global-ids.ts';
export * from './resolve-nodes.ts';
export function capitalize(s: string) {
    return `${s.slice(0, 1).toUpperCase()}${s.slice(1)}`;
}
