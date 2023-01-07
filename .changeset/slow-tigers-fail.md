---
'@pothos/plugin-errors': minor
---

Add `defaultGetTypeName` option to `@pothos/plugin-errors`, this option allows customizing the
generated type names by this plugin.

An example usage of this:

```ts
export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
    defaultResultOptions: {
            name: ({ parentTypeName, fieldName }) => `${fieldName}_CustomResult`,
    },
    defaultUnionOptions: {
            name: ({ parentTypeName, fieldName }) => `${fieldName}_CustomUnion`,
    },
  },
});
```
