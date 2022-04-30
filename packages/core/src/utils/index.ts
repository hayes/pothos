import { OutputType, SchemaTypes, typeBrandKey } from '../types';

export * from './context-cache';
export * from './enums';
export * from './input';
export * from './params';
export * from './sort-classes';

export function assertNever(value: never): never {
  throw new TypeError(`Unexpected value: ${value}`);
}

export function assertArray(value: unknown): value is unknown[] {
  if (!Array.isArray(value)) {
    throw new TypeError('List resolvers must return arrays');
  }

  return true;
}

export function isThenable(value: unknown): value is Promise<unknown> {
  return !!(
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as Record<string, unknown>).then === 'function'
  );
}

export function verifyRef(ref: unknown) {
  if (ref === undefined) {
    throw new Error(`Received undefined as a type ref.
        
This is often caused by a circular import
If this ref is imported from a file that re-exports it (like index.ts)
you may be able to resolve this by importing it directly from the file that defines it.
`);
  }
}

export function verifyInterfaces(interfaces: unknown) {
  if (!interfaces || typeof interfaces === 'function') {
    return;
  }

  if (!Array.isArray(interfaces)) {
    throw new TypeError('interfaces must be an array or function');
  }

  for (const iface of interfaces) {
    if (iface === undefined) {
      throw new Error(`Received undefined in list of interfaces.
        
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
  if (typeof val !== 'object' || val === null) {
    return;
  }

  Object.defineProperty(val, typeBrandKey, {
    enumerable: false,
    value: type,
  });
}

export function getTypeBrand(val: unknown) {
  if (typeof val === 'object' && val !== null && typeBrandKey in val) {
    return (val as { [typeBrandKey]: OutputType<SchemaTypes> })[typeBrandKey];
  }

  return null;
}
