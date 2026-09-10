import type { InferredFieldOptionsKind } from './builder-options.js';
import type { MaybePromise } from './utils.js';

export interface SchemaTypes extends PothosSchemaTypes.UserSchemaTypes {
  outputShapes: {
    String: unknown;
    ID: unknown;
    Int: unknown;
    Float: unknown;
    Boolean: unknown;
  };
  inputShapes: {
    String: unknown;
    ID: unknown;
    Int: unknown;
    Float: unknown;
    Boolean: unknown;
  };
  Objects: {};
  Inputs: {};
  Interfaces: {};
  Scalars: {
    String: { Input: unknown; Output: unknown };
    ID: { Input: unknown; Output: unknown };
    Int: { Input: unknown; Output: unknown };
    Float: { Input: unknown; Output: unknown };
    Boolean: { Input: unknown; Output: unknown };
  };
  DefaultFieldNullability: boolean;
  DefaultInputFieldRequiredness: boolean;
  AsyncSelections: boolean;
  InferredFieldOptionsKind: InferredFieldOptionsKind;
  Root: object;
  Context: object;
}

/**
 * The type of a selection an ORM plugin's callback may return: a promise only when the schema
 * sets `AsyncSelections: true`. `true extends` rather than `extends true` so that a `Types` that
 * has not resolved the flag — the bare `SchemaTypes` the plugins use internally — keeps the
 * wider type.
 */
export type MaybeAsyncSelection<
  Types extends SchemaTypes,
  T,
> = true extends Types['AsyncSelections'] ? MaybePromise<T> : T;

/**
 * Intersected into a `select` option to reject a callback that builds its selection
 * asynchronously when the schema has not set `AsyncSelections: true`. The option's own type
 * cannot reject it: the selection it returns is a map of optional keys, which a promise satisfies
 * structurally once the option is intersected with the type parameter that captures it.
 */
export type CheckAsyncSelection<
  Types extends SchemaTypes,
  Select,
> = true extends Types['AsyncSelections']
  ? unknown
  : // biome-ignore lint/suspicious/noExplicitAny: matching against any callback
    Select extends (...args: any[]) => infer Selection
    ? // The callback as a whole returning a promise is not the only async shape: a callback
      // whose return type is a union with a promise in it — `Selection | Promise<Selection>`,
      // which a generic can also erase to — is async on some path, and is not assignable to
      // `(...args: any[]) => PromiseLike<unknown>`. Ask whether any member of the return type
      // is promise-like instead, so a union with one async member is rejected too. Wrapping
      // both sides in a tuple keeps `never` — a return type with no promise member — from
      // distributing the conditional away.
      [Extract<Selection, PromiseLike<unknown>>] extends [never]
      ? unknown
      : 'An async selection requires `AsyncSelections: true` in the schema types'
    : unknown;

export type MergedScalars<PartialTypes extends Partial<PothosSchemaTypes.UserSchemaTypes>> = (
  PartialTypes['Defaults'] extends 'v3'
    ? V3DefaultScalars
    : DefaultScalars
) extends infer Defaults
  ? SchemaTypes['Scalars'] & {
      [K in keyof Defaults | keyof PartialTypes['Scalars']]: K extends keyof PartialTypes['Scalars']
        ? PartialTypes['Scalars'][K]
        : K extends keyof Defaults
          ? Defaults[K]
          : never;
    }
  : never;

export interface VersionedSchemaBuilderOptions<Types extends SchemaTypes> {
  v3: PothosSchemaTypes.V3SchemaBuilderOptions<Types>;
}

export interface DefaultsByVersion {
  v3: PothosSchemaTypes.V3DefaultSchemaTypes;
}

export interface DefaultScalars {
  String: { Input: string; Output: string };
  ID: { Input: string; Output: bigint | number | string };
  Int: { Input: number; Output: number };
  Float: { Input: number; Output: number };
  Boolean: { Input: boolean; Output: boolean };
}

export interface V3DefaultScalars {
  String: { Input: string; Output: string };
  ID: { Input: number | string; Output: number | string };
  Int: { Input: number; Output: number };
  Float: { Input: number; Output: number };
  Boolean: { Input: boolean; Output: boolean };
}

export type BaseScalarNames = 'Boolean' | 'Float' | 'ID' | 'Int' | 'String';

export type ScalarName<Types extends SchemaTypes> = string &
  (BaseScalarNames | keyof Types['Scalars']);

export type RootName = 'Mutation' | 'Query' | 'Subscription';
