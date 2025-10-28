import {
  type DirectiveNode,
  type FieldNode,
  type GraphQLDirective,
  type GraphQLField,
  getArgumentValues,
} from 'graphql';
import { PothosSchemaError, PothosValidationError } from '../errors';
import { InputListRef } from '../refs/input-list';
import { ListRef } from '../refs/list';
import {
  type InputType,
  type InputTypeParam,
  type MaybePromise,
  type OutputType,
  type PartialResolveInfo,
  type PothosOutputFieldConfig,
  type SchemaTypes,
  type TypeParam,
  typeBrandKey,
} from '../types';

export * from './base64';
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
    throw new PothosValidationError('List resolvers must return arrays');
  }

  return true;
}

export function isThenable(value: unknown): value is PromiseLike<unknown> {
  return !!(
    value &&
    (typeof value === 'object' || typeof value === 'function') &&
    typeof (value as Record<string, unknown>).then === 'function'
  );
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
  if (!interfaces || typeof interfaces === 'function') {
    return;
  }

  if (!Array.isArray(interfaces)) {
    throw new PothosSchemaError('interfaces must be an array or function');
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

type BrandWithTypeResult<T, Types extends SchemaTypes> = T extends Record<string, unknown>
  ? {
      [K in keyof T | typeof typeBrandKey]: K extends keyof T
        ? T[K]
        : OutputType<Types>
    }
  : T;

export function brandWithType<T, Types extends SchemaTypes>(
  val: T,
  type: OutputType<Types>,
): BrandWithTypeResult<T, Types> {
  if (typeof val !== 'object' || val === null) {
    return val as BrandWithTypeResult<T, Types>;
  }

  Object.defineProperty(val, typeBrandKey, {
    enumerable: false,
    value: type,
  });

  return val as BrandWithTypeResult<T, Types>;
}

export function getTypeBrand(val: unknown) {
  if (typeof val === 'object' && val !== null && typeBrandKey in val) {
    return (val as { [typeBrandKey]: OutputType<SchemaTypes> })[typeBrandKey];
  }

  return null;
}

export function unwrapListParam<Types extends SchemaTypes>(
  param: InputTypeParam<Types> | TypeParam<Types>,
): InputType<Types> | OutputType<Types> {
  if (Array.isArray(param)) {
    return unwrapListParam(param[0]);
  }

  if (param instanceof ListRef || param instanceof InputListRef) {
    return unwrapListParam(param.listType as TypeParam<Types>);
  }

  return param;
}

export function unwrapOutputListParam<Types extends SchemaTypes>(
  param: TypeParam<Types>,
): OutputType<Types> {
  if (Array.isArray(param)) {
    return unwrapOutputListParam(param[0]);
  }

  if (param instanceof ListRef) {
    return unwrapOutputListParam(param.listType as TypeParam<Types>);
  }

  return param;
}

export function unwrapInputListParam<Types extends SchemaTypes>(
  param: InputTypeParam<Types>,
): InputType<Types> {
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
export function completeValue<T, R>(
  valOrPromise: PromiseLike<T> | T,
  onSuccess: (completedVal: T) => PromiseLike<R> | R,
  onError?: (errVal: unknown) => PromiseLike<R> | R,
): Promise<Awaited<R>> | Awaited<R> {
  if (isThenable(valOrPromise)) {
    return Promise.resolve(valOrPromise).then(onSuccess, onError) as Promise<Awaited<R>>;
  }
  // No need to handle onError, this should just be a try/catch inside the `onSuccess` block
  const result = onSuccess(valOrPromise);

  // If the result of the synchronous call is a promise like, convert to a promise
  // for consistency
  if (isThenable(result)) {
    return Promise.resolve(result);
  }
  return result as Awaited<R>;
}

export function getMappedArgumentValues(
  def: GraphQLDirective | GraphQLField<unknown, unknown>,
  node: DirectiveNode | FieldNode,
  context: object,
  info: PartialResolveInfo,
) {
  const args = getArgumentValues(def, node, info.variableValues);
  const mappers = def.extensions?.pothosArgMappers as
    | PothosOutputFieldConfig<SchemaTypes>['argMappers']
    | undefined;

  if (mappers && mappers.length > 0) {
    return reduceMaybeAsync(mappers, args, (acc, argMapper) => argMapper(acc, context, info));
  }

  return args;
}

export function reduceMaybeAsync<T, R>(
  items: T[],
  initialValue: R,
  fn: (value: R, item: T, i: number) => MaybePromise<R>,
): MaybePromise<R> {
  function next(value: R, i: number): MaybePromise<R> {
    if (i === items.length) {
      return value;
    }

    return completeValue(fn(value, items[i], i), (result) => {
      return result === null ? (null as R) : next(result, i + 1);
    });
  }

  return next(initialValue, 0);
}
