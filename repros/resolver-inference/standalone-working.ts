/**
 * Working inference experiments for standalone.ts. No Pothos or GraphQL imports.
 * Tested with strict mode on TypeScript 7.0.2.
 * TypeScript 5.9.3 still widens some enum returns here; compiler version matters.
 * Locally: tsc -p repros/resolver-inference/tsconfig.standalone-working.json
 *
 * The extra const Return parameter captures the callback return and constrains it
 * to MaybePromise<Shape<T>>.
 * This is an experiment, not a complete replacement for Pothos's resolver types:
 * const inference also makes nested array literals readonly.
 * The two-stage bindType version at the bottom also accepts mutable backing arrays.
 */
export {};

type Ref<T> = { readonly shape: T };
type Shape<T> = T extends Ref<infer Value> ? Value : never;
type MaybePromise<T> = T | Promise<T>;

// The implementation can stay irrelevant here: this is a compile-time experiment.
// Edit this declaration to try different inference/validation strategies.
declare function field<
  T extends Ref<unknown>,
  const Return extends MaybePromise<Shape<T>>,
>(options: { type: T; resolve: () => Return }): void;

type Unit = 'Feet' | 'Meters';
type Animal = { kind: 'giraffe'; height: number } | { kind: 'lion'; hasMane: boolean };

declare const Unit: Ref<Unit>;
declare const Animal: Ref<Animal>;
declare const Animals: Ref<readonly Animal[]>;
declare const choose: boolean;

// All valid, with no callback annotations or assertions.
field({ type: Unit, resolve: () => 'Feet' });
field({ type: Unit, resolve: async () => 'Feet' });
field({ type: Unit, resolve: () => (choose ? 'Feet' : 'Meters') });
field({ type: Animal, resolve: () => ({ kind: 'giraffe', height: 5 }) });
field({ type: Animal, resolve: async () => ({ kind: 'lion', hasMane: true }) });
field({
  type: Animal,
  resolve: () => (choose ? { kind: 'giraffe', height: 5 } : { kind: 'lion', hasMane: true }),
});
field({
  type: Animals,
  resolve: () => [
    { kind: 'giraffe', height: 5 },
    { kind: 'lion', hasMane: true },
  ],
});
field({ type: Animals, resolve: async () => [{ kind: 'giraffe', height: 5 }] });

// Safety checks. An unused @ts-expect-error means an edit has weakened validation.
// @ts-expect-error invalid enum member
field({ type: Unit, resolve: () => 'Yards' });
// @ts-expect-error invalid async enum member
field({ type: Unit, resolve: async () => 'Yards' });
// @ts-expect-error invalid union branch
field({ type: Unit, resolve: () => (choose ? 'Feet' : 'Yards') });
// @ts-expect-error invalid discriminator
field({ type: Animal, resolve: () => ({ kind: 'zebra', height: 5 }) });
// @ts-expect-error missing required property
field({ type: Animal, resolve: async () => ({ kind: 'lion' }) });
// @ts-expect-error invalid list member
field({ type: Animals, resolve: () => [{ kind: 'zebra', height: 5 }] });
declare const widened: string;
// @ts-expect-error string is wider than the enum
field({ type: Unit, resolve: () => widened });

// Known limitation: these SHOULD be accepted, but const inference makes ['a'] readonly.
// Remove these two directives when experimenting with a fix for mutable backing shapes.
declare const MutableModel: Ref<{ values: string[] }>;
// @ts-expect-error known limitation: valid mutable backing array
field({ type: MutableModel, resolve: () => ({ values: ['a'] }) });
// @ts-expect-error known limitation: valid async mutable backing array
field({ type: MutableModel, resolve: async () => ({ values: ['a'] }) });

// Two-stage version: T is fixed before Return is inferred. All valid calls below pass.
declare function bindType<T extends Ref<unknown>>(
  type: T,
): <const Return extends MaybePromise<Shape<T>>>(options: { resolve: () => Return }) => void;

bindType(Unit)({ resolve: () => 'Feet' });
bindType(Unit)({ resolve: async () => 'Feet' });
bindType(Animal)({ resolve: () => ({ kind: 'giraffe', height: 5 }) });
bindType(Animal)({ resolve: async () => ({ kind: 'giraffe', height: 5 }) });
bindType(MutableModel)({ resolve: () => ({ values: ['a'] }) });
bindType(MutableModel)({ resolve: async () => ({ values: ['a'] }) });
// @ts-expect-error invalid enum member
bindType(Unit)({ resolve: () => 'Yards' });
// @ts-expect-error invalid backing property
bindType(MutableModel)({ resolve: () => ({ values: [1] }) });

bindType(Animals)({ resolve: () => [{ kind: 'giraffe', height: 5 }] });
bindType(Animals)({ resolve: async () => [{ kind: 'lion', hasMane: true }] });
// @ts-expect-error invalid async enum member
bindType(Unit)({ resolve: async () => 'Yards' });
// @ts-expect-error missing member property
bindType(Animal)({ resolve: async () => ({ kind: 'lion' }) });
declare const readonlyValues: readonly string[];
// @ts-expect-error explicitly readonly values cannot back a mutable array
bindType(MutableModel)({ resolve: () => ({ values: readonlyValues }) });
