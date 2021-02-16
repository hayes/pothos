---
name: Changing Default Nullability
menu: Guide
---

# Changing Default Nullability

By Default GiraphQL makes fields on output types Non-Nullable, and Arguments and Fields on InputObjects optional. These defaults can be overwritten by either setting setting `nullable: true` in the options for output fields and by setting `required: true` for input fields or arguments.

These defaults may not be the right choice for every application, and changing them on every field can be a pain. Instead, GiraphQL allows overwriting these defaults when setting up your SchemaBuilder. You will need to provide the new defaults in 2 places:

1. In the type parameter for the builder, which enables the type checking to work with your new

   settings

2. In the Builder options, so that the correct schema is built at run time.

```typescript
// Create a Builder that makes output fields nullable by default
export const builder = new SchemaBuilder<{
  DefaultFieldNullability: true;
}>({
  defaultFieldNullability: true,
});

// Create a Builder that makes input fields and arguments required by default
export const builder = new SchemaBuilder<{
  DefaultInputFieldRequiredness: true;
}>({
  defaultInputFieldRequiredness: true,
});
```

