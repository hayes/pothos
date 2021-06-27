// @ts-nocheck
export * from './context-cache.ts';
export * from './enums.ts';
export * from './input.ts';
export * from './params.ts';
export * from './sort-classes.ts';
export function assertNever(value: never): never {
    throw new TypeError(`Unexpected value: ${value}`);
}
export function assertArray(value: unknown): value is unknown[] {
    if (!Array.isArray(value)) {
        throw new TypeError("List resolvers must return arrays");
    }
    return true;
}
export function isThenable(value: unknown): value is Promise<unknown> {
    return !!(value &&
        (typeof value === "object" || typeof value === "function") &&
        typeof (value as Record<string, unknown>).then === "function");
}
