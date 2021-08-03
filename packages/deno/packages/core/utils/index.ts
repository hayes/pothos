// @ts-nocheck
import { OutputType, SchemaTypes, typeBrandKey } from '../index.ts';
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
        throw new Error(`Received undefined as a type ref.
        
This is often caused by a circular import
If this ref is imported from a file that re-exports it (like index.ts)
you may be able to resolve this by importing it directly fron the file that defines it.
`);
    }
}
export function brandWithType<Types extends SchemaTypes>(val: unknown, type: OutputType<Types>) {
    if (typeof val !== "object" || val === null) {
        return;
    }
    Object.defineProperty(val, typeBrandKey, {
        enumerable: false,
        value: type,
    });
}
