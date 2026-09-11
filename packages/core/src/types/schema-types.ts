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
 * What the runtime treats as async: `isThenable` accepts any object with a callable `then`, and
 * `Promise.resolve` assimilates the same shapes, so a selection carrying one is planned
 * asynchronously whatever its `then` signature says. `PromiseLike<unknown>` is narrower — its
 * `then` takes two specific parameters — so a hand-rolled thenable is not assignable to it and a
 * check written against it would accept a selection the runtime then awaits.
 */
// biome-ignore lint/suspicious/noExplicitAny: matching against any callable `then`
type ThenableSelection = { then: (...args: any[]) => unknown };

/**
 * Every thenable a callback type can produce, collected across the whole type. The conditional
 * distributes on purpose, so a union of callback types — `(() => Selection) | (() => Promise<
 * Selection>)`, the shape a `MaybePromise`-typed helper is often written as — is taken a member
 * at a time and each member's return type is inspected on its own. Collecting the thenables
 * rather than each member's verdict is what makes that safe: a verdict union would be
 * `unknown | Diagnostic`, which collapses to `unknown` and accepts the async member. A union of
 * thenables collapses to nothing only when there are none.
 *
 * Within one member, `Extract` looks past the return type as a whole: a callback returning
 * `Selection | Promise<Selection>` — which a generic can erase to — is async on one of its paths
 * and is not assignable to `(...args: any[]) => ThenableSelection`, but it has a thenable in it.
 */
// biome-ignore lint/suspicious/noExplicitAny: matching against any callback
type AsyncSelectionMembers<Select> = Select extends (...args: any[]) => infer Selection
  ? Extract<Selection, ThenableSelection>
  : never;

/**
 * Intersected into a `select` option to reject a callback that builds its selection
 * asynchronously when the schema has not set `AsyncSelections: true`. The option's own type
 * cannot reject it: the selection it returns is a map of optional keys, which a promise satisfies
 * structurally once the option is intersected with the type parameter that captures it.
 *
 * Known gap: a callback typed as an overload set slips through. `infer` resolves an overloaded
 * type to its last signature, so an async overload hidden behind a final synchronous one is read
 * as synchronous even though the plugins call the callback with the arguments that select the
 * async overload. TypeScript cannot enumerate a type's signatures, and the pattern that recovers
 * some of them — matching against an object with a fixed number of call signatures — is bounded
 * by the number written into the pattern: one more synchronous overload than the pattern counts
 * hides the async one again. A guard that can always be stepped around would read as protection
 * this check does not give, so the gap is left open and named here instead.
 */
export type CheckAsyncSelection<
  Types extends SchemaTypes,
  Select,
> = true extends Types['AsyncSelections']
  ? unknown
  : // Wrapping both sides in a tuple keeps `never` — a callback that is not async, and a `Select`
    // that is not a callback at all — from distributing the conditional away.
    [AsyncSelectionMembers<Select>] extends [never]
    ? unknown
    : 'An async selection requires `AsyncSelections: true` in the schema types';

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
