/**
 * Standalone contextual-return inference repro. No Pothos or GraphQL imports.
 * Paste this entire file into the TypeScript Playground with strict mode enabled.
 * Locally: tsc -p repros/resolver-inference/tsconfig.standalone.json
 *
 * Valid calls deliberately have no @ts-expect-error: their diagnostics are the repro.
 * Invalid calls have @ts-expect-error so a change that accepts them is also reported.
 * Start by editing Shape, Resolver, FieldOptions, or the field declaration below.
 */
type Ref<T> = { readonly shape: T };
type Shape<T> = T extends Ref<infer Value> ? Value : never;
type MaybePromise<T> = T | Promise<T>;
type Resolver<T> = () => MaybePromise<T>;

type FieldOptions<T extends Ref<unknown>> = {
  type: T;
  resolve: Resolver<Shape<T>>;
};

declare function field<T extends Ref<unknown>>(options: FieldOptions<T>): void;

type Unit = 'Feet' | 'Meters';
type Animal = { kind: 'giraffe'; height: number } | { kind: 'lion'; hasMane: boolean };

declare const Unit: Ref<Unit>;
declare const Animal: Ref<Animal>;
declare const Model: Ref<{ values: string[] }>;
declare const choose: boolean;

// 1. Same-call inference: all of these returns are valid for the declared type.
field({ type: Unit, resolve: () => 'Feet' });
field({ type: Unit, resolve: () => (choose ? 'Feet' : 'Meters') });
field({ type: Unit, resolve: async () => 'Feet' });
field({ type: Animal, resolve: () => ({ kind: 'giraffe', height: 5 }) });
field({ type: Animal, resolve: async () => ({ kind: 'giraffe', height: 5 }) });
field({ type: Model, resolve: () => ({ values: ['a'] }) });
field({ type: Model, resolve: async () => ({ values: ['a'] }) });

// 2. Concrete context: no generic inference from a sibling `type` property.
export const concreteEnum: Resolver<Unit> = () => 'Feet';
export const concreteObject: Resolver<Animal> = () => ({ kind: 'giraffe', height: 5 });

// Async has an additional wrinkle: compare a promise-only context with MaybePromise.
export const promiseOnly: () => Promise<Unit> = async () => 'Feet';
export const maybePromise: Resolver<Unit> = async () => 'Feet';

// 3. Experiment: prevent inference from the expected return using NoInfer (TS 5.4+).
// This blocks an inference source; it does not itself introduce a second checking pass.
declare function deferredField<T extends Ref<unknown>>(options: {
  type: T;
  resolve: Resolver<NoInfer<Shape<T>>>;
}): void;

deferredField({ type: Unit, resolve: () => 'Feet' });
deferredField({ type: Animal, resolve: () => ({ kind: 'giraffe', height: 5 }) });
deferredField({ type: Unit, resolve: async () => 'Feet' });

// 4. Actual two-stage control: resolve T in one call before supplying the callback.
// This is a diagnostic comparison, not a proposed change to Pothos's public API.
declare function bindType<T extends Ref<unknown>>(
  type: T,
): (options: { resolve: Resolver<Shape<T>> }) => void;

const unitField = bindType(Unit);
const animalField = bindType(Animal);
unitField({ resolve: () => 'Feet' });
animalField({ resolve: () => ({ kind: 'giraffe', height: 5 }) });
unitField({ resolve: async () => 'Feet' });

// 5. Safety checks: keep these rejected while making the valid calls above pass.
// @ts-expect-error invalid enum member
field({ type: Unit, resolve: () => 'Yards' });
// @ts-expect-error invalid async enum member
field({ type: Unit, resolve: async () => 'Yards' });
// @ts-expect-error invalid discriminator
field({ type: Animal, resolve: () => ({ kind: 'zebra', height: 5 }) });
// @ts-expect-error missing required property for the lion member
field({ type: Animal, resolve: () => ({ kind: 'lion' }) });
// @ts-expect-error incompatible backing array
field({ type: Model, resolve: () => ({ values: [1] }) });

declare const widened: string;
declare const readonlyValues: readonly string[];
// @ts-expect-error a general string is wider than the enum
field({ type: Unit, resolve: () => widened });
// @ts-expect-error a readonly array cannot back a mutable array
field({ type: Model, resolve: () => ({ values: readonlyValues }) });
// @ts-expect-error deferring inference must not admit invalid members
deferredField({ type: Unit, resolve: () => 'Yards' });
// @ts-expect-error the two-stage control must also reject invalid members
unitField({ resolve: () => 'Yards' });
