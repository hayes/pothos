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
export function verifyRef(ref: unknown) {
    if (ref === undefined) {
        throw new Error(`Received undefined as a type ref.  This is often caused by circular import.  In some cases this can be fixed by importing the type ref directly from the file that defines it rather than an index file`);
    }
}
