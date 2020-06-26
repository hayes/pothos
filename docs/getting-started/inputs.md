---
name: Input Types
menu: Guide
---

# Input Objects

## Creating Input objects

Input objects can be created using builder.inputType.

```typescript
const GiraffeInput = builder.inputType('GiraffeInput', {
    fields: (t) => ({
        name: t.string({ required: true }),
        birthdate: t.string({ required: true }),
        height: t.float({ required: true }),
    }),
});

builder.mutationType({
    fields: (t) => ({
        createGiraffe: t.field({
            type: Giraffe,
            args: {
                input: t.arg({ type: GiraffeInput, required: true }),
            },
            resolve: (root, args) =>
                new Giraffe(args.input.name, new Date(args.input.birthdate), args.input.height),
        }),
    }),
});
```

## Recursive inputs

Types for recusive inputs get a slightly more complicated to implement because their types can't easoly be inferred. Referencining other input types works without any additional logic, as long as there is no circular reference to the original type.

To build input types with recusive references you can use `builder.inputRef` along with a type or interface that descibes the fields of your input object. The builder will still ensure all the types are correct, but needs to type definitions to help infer the correct values.

```typescript
interface RecursiveGiraffeInputShape {
    name: string;
    birthdate: string;
    height: number;
    friends?: RecursiveGiraffeInputShape[];
}

const RecursiveGiraffeInput = builder
    .inputRef<RecursiveGiraffeInputShape>('RecursiveGiraffeInput')
    .implement({
        fields: (t) => ({
            name: t.string({ required: true }),
            birthdate: t.string({ required: true }),
            height: t.float({ required: true }),
            friends: t.field({
                type: [GiraffeInput],
            }),
        }),
    });

builder.mutationType({
    fields: (t) => ({
        createGiraffeWithFriends: t.field({
            type: [Giraffe],
            args: {
                input: t.arg({ type: RecursiveGiraffeInput, required: true }),
            },
            resolve: (root, args) => {
                const friends = (args.input.friends || []).map(
                    (friend) =>
                        new Giraffe(
                            args.input.name,
                            new Date(args.input.birthdate),
                            args.input.height,
                        ),
                );

                return [
                    new Giraffe(args.input.name, new Date(args.input.birthdate), args.input.height),
                    ...friends,
                ];
            },
        }),
    }),
});
```

