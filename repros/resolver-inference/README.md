# Resolver inference experiments

These files have no Pothos or GraphQL dependencies and can be pasted into the TypeScript Playground with strict mode enabled.

- `standalone.ts` reproduces widening for enum and discriminated object-union returns. It compares the generic call with concrete expected types, `NoInfer`, and binding the schema type in a separate call. Valid cases intentionally produce compiler errors; invalid cases use `@ts-expect-error` to detect weakened validation.
- `standalone-working.ts` compares a single-call `const` return parameter with a two-stage `bindType(type)({ resolve })` signature. On TypeScript 7.0.2, both accept enum and object-union members, including async returns and object-union lists. The single-call version still rejects mutable backing-array literals; those two known failures are explicitly marked. The two-stage version accepts those arrays while rejecting explicitly readonly values for mutable backing shapes.

Run from the repository root:

```sh
pnpm exec tsc -p repros/resolver-inference/tsconfig.standalone.json
pnpm exec tsc -p repros/resolver-inference/tsconfig.standalone-working.json
```

The first command is expected to fail. The second passes on TypeScript 7.0.2. TypeScript 5.9.3 still widens some enum returns in the working experiment, including the two-stage async enum case.

The two-stage signature demonstrates binding the schema type before inferring the callback. It is an API experiment, not an implementation of a new Pothos builder method. `NoInfer` alone did not fix the same-call cases.
