---
name: Patterns
menu: Guide
---

# Patterns

## Sharing fields between types

If you have common fields or arguments that are shared across multiple types (but you don't want to
use an interface to share the common logic) you can write helper functions to generate these fields
for you.

### Objects and Interfaces

```ts
import { ObjectRef } from '@giraphql/core';
import builder from './builder';

function addCommonFields(refs: ObjectRef<unknown, { id: string }>[]) {
  for (const ref of refs) {
    builder.objectFields(ref, (t) => ({
      id: t.exposeID('id', {}),
      idLength: t.int({
        resolve: (parent) => parent.id.length,
      }),
    }));
  }
}

const WithCommonFields1 = builder.objectRef<{ id: string }>('WithCommonFields1').implement({});
const WithCommonFields2 = builder.objectRef<{ id: string }>('WithCommonFields2').implement({});

addCommonFields([WithCommonFields1, WithCommonFields2]);
```

This will apply the `id` and `idLength` fields to both of the object types. The `ObjectRef` type is
what is returned when creating an object (or when calling `builder.objectRef`). It takes 2 generic
parameters: The first is the shape a resolver is expected to resolve to for that type, and the
second is the shape of the parent arg when defining a field on that type. These 2 are generally the
same, but can differ for some special cases (like with `loadableObject` from the dataloader plugin,
which allows resolvers to resolve to an `ID` rather than the actual object). In this case, we only
care about the second parameter since we are defining fields.

If you want to define fields on an interface, you can use `InterfaceRef` instead. If your helper
accepts both, you can differentiate the refs by using `ref.kind` which will be either `Object` or
`Interface`.

### Args

Args are a little more complicated fields on objects and interfaces. GiraphQL infers the shape of
args for your resolvers, so you can't just add on more args later. Instead, we can define a helper
that returns a set of args to apply to your field. To make this work, we need to get a few extra
types:

```ts
import { InputFieldBuilder } from '@giraphql/core';

export interface SchemaTypes {
  Scalars: {
    ID: {
      Input: string;
      Output: string;
    };
  };
}
export type TypesWithDefaults = GiraphQLSchemaTypes.ExtendDefaultTypes<SchemaTypes>;

const builder = new SchemaBuilder<SchemaTypes>({});

function createCommonArgs(arg: ArgBuilder<TypesWithDefault>) {
  return {
    id: arg.id({}),
    reason: arg({ type: 'String', required: false }),
  };
}

builder.mutationType({
  fields: (t) => ({
    mutation1: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (parent, args) => !!args.reason,
    }),
    mutation2: t.boolean({
      args: {
        ...createCommonArgs(t.arg),
      },
      resolve: (parent, args) => !!args.reason,
    }),
  }),
});
```

I this example `SchemaTypes` are the types that will be provided to the builder when it is created.
Internally GiraphQL extends these with some default types. This extened set of types is what gets
passed around in many of GiraphQLs internal types. To correctly type our helper function, we need to
create a version of `SchemaTypes` with the same defaults GiraphQL adds in (`TypesWithDefaults`).
Once we have `TypesWithDefaults` we can define a helper function that accepts an arg builder
(`ArgBuilder<TypesWithDefaults>`) and creates a set of arguments.

The last step is to call your helper with `t.arg` (the arg builder), and spread the returned args
into the args object for the current field.

### Input fields

Input fields are similar to args, and also all need to be present when the type is defined so that
GiraphQL can infer the correct types.

```ts
import { InputFieldBuilder } from '@giraphql/core';
import builder, { TypesWithDefault } from './builder';

function createInputFields(t: InputFieldBuilder<TypesWithDefault, 'InputObject'>) {
  return {
    id: t.id({}),
    reason: t.field({ type: 'String', required: false }),
  };
}

builder.inputType('InputWithCommonFields1', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});

builder.inputType('InputWithCommonFields2', {
  fields: (t) => ({
    ...createInputFields(t),
  }),
});
```
