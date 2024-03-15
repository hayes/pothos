// @ts-nocheck
import { PothosSchemaError, PothosValidationError } from '../errors.ts';
import { InputListRef } from '../refs/input-list.ts';
import { ListRef } from '../refs/list.ts';
import { InputType, InputTypeParam, OutputType, SchemaTypes, typeBrandKey, TypeParam, } from '../types/index.ts';
export * from './base64.ts';
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
        throw new PothosValidationError("List resolvers must return arrays");
    }
    return true;
}
export function isThenable(value: unknown): value is PromiseLike<unknown> {
    return !!(value &&
        (typeof value === "object" || typeof value === "function") &&
        typeof (value as Record<string, unknown>).then === "function");
}
export function verifyRef(ref: unknown) {
    if (ref === undefined) {
        throw new PothosSchemaError(`Received undefined as a type ref.

This is often caused by a circular import
If this ref is imported from a file that re-exports it (like index.ts)
you may be able to resolve this by importing it directly from the file that defines it.
`);
    }
}
export function verifyInterfaces(interfaces: unknown) {
    if (!interfaces || typeof interfaces === "function") {
        return;
    }
    if (!Array.isArray(interfaces)) {
        throw new PothosSchemaError("interfaces must be an array or function");
    }
    for (const iface of interfaces) {
        if (iface === undefined) {
            throw new PothosSchemaError(`Received undefined in list of interfaces.

This is often caused by a circular import
If this ref is imported from a file that re-exports it (like index.ts)
you may be able to resolve this by importing it directly from the file that defines it.

Alternatively you can define interfaces with a function that will be lazily evaluated,
which may resolver issues with circular dependencies:

Example:
builder.objectType('MyObject', {
  interface: () => [Interface1, Interface2],
  ...
});
`);
        }
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
export function getTypeBrand(val: unknown) {
    if (typeof val === "object" && val !== null && typeBrandKey in val) {
        return (val as {
            [typeBrandKey]: OutputType<SchemaTypes>;
        })[typeBrandKey];
    }
    return null;
}
export function unwrapListParam<Types extends SchemaTypes>(param: InputTypeParam<Types> | TypeParam<Types>): InputType<Types> | OutputType<Types> {
    if (Array.isArray(param)) {
        return unwrapListParam(param[0]);
    }
    if (param instanceof ListRef || param instanceof InputListRef) {
        return unwrapListParam(param.listType as TypeParam<Types>);
    }
    return param;
}
export function unwrapOutputListParam<Types extends SchemaTypes>(param: TypeParam<Types>): OutputType<Types> {
    if (Array.isArray(param)) {
        return unwrapOutputListParam(param[0]);
    }
    if (param instanceof ListRef) {
        return unwrapOutputListParam(param.listType as TypeParam<Types>);
    }
    return param;
}
export function unwrapInputListParam<Types extends SchemaTypes>(param: InputTypeParam<Types>): InputType<Types> {
    if (Array.isArray(param)) {
        return unwrapInputListParam(param[0]);
    }
    if (param instanceof InputListRef) {
        return unwrapInputListParam(param.listType as InputTypeParam<Types>);
    }
    return param;
}
/**
 * Helper for allowing plugins to fulfill the return of the `next` resolver, without paying the cost of the
 * Promise if not required.
 */
export function completeValue<T, R>(valOrPromise: PromiseLike<T> | T, onSuccess: (completedVal: T) => R, onError?: (errVal: unknown) => R): Promise<R> | R {
    if (isThenable(valOrPromise)) {
        return Promise.resolve(valOrPromise).then(onSuccess, onError);
    }
    // No need to handle onError, this should just be a try/catch inside the `onSuccess` block
    const result = onSuccess(valOrPromise);
    // If the result of the synchronous call is a promise like, convert to a promise
    // for consistency
    if (isThenable(result)) {
        return Promise.resolve(result);
    }
    return result;
}
