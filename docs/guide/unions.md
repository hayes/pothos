---
name: Union Types
menu: Guide
---

# unions

## Defining Union Types

Union types are defined with a list of object types:

```typescript
const builder = new SchemaBuilder<{
    Objects: {
        GiraffeStringFact: { factKind: 'string'; fact: string };
        GiraffeNumericFact: { factKind: 'number'; fact: string; value: number };
    };
}>({});

builder.objectType('GiraffeStringFact', {
    fields: (t) => ({
        fact: t.exposeString('fact', {}),
    }),
});

const GiraffeNumericFact = builder.objectType('GiraffeNumericFact', {
    fields: (t) => ({
        fact: t.exposeString('fact', {}),
        value: t.exposeFloat('value', {}),
    }),
});

const GiraffeFact = builder.unionType('GiraffeFact', {
    types: ['GiraffeStringFact', GiraffeNumericFact],
    resolveType: (fact) => {
        switch (fact.factKind) {
            case 'number':
                return GiraffeNumericFact;
            case 'string':
                return 'GiraffeStringFact';
        }
    },
});
```

The `types` array can either contain Object type names defined in [TypeInfo](https://github.com/hayes/giraphql/tree/d9ede803cce6816f6760f89b9301c6607bc1ad66/api-schema-builder/README.md#typeinfo), or and Object `Ref` created by object type. `builder.objectType`, `builder.objectRef` or other method, or a class that was used to implement an object type.

The `resolveType` function will be called with each item returned by a field that returnes the unionType, and is used to determine which concrete the value corresponds to. It is ussualy good to have a shared property you can use to differentiate your union members.

## Using Union Types

```typescript
builder.queryField('giraffeFacts', (t) =>
    t.field({
        type: [GiraffeFact],
        resolve: () => {
            const fact1 = {
                factKind: 'string',
                fact:
                    'A giraffe’s spots are much like human fingerprints. No two individual giraffes have exactly the same pattern',
            } as const;

            const fact2 = {
                factKind: 'number',
                fact: 'Top speed (MPH)',
                value: 35,
            } as const;

            return [fact1, fact2];
        },
    }),
);
```

