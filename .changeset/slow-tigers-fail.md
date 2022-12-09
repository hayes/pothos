---
'@pothos/plugin-errors': patch
---

Add `defaultGetTypeName` option to `@pothos/plugin-errors`, this option allows customizing the
generated type names by this plugin.

An example usage of this:

```typescript
export const builderWithCustomErrorTypeNames = new SchemaBuilder<{}>({
  plugins: [ErrorPlugin, ValidationPlugin],
  errorOptions: {
    defaultTypes: [Error],
    defaultGetTypeName: ({ fieldName, kind }) => `${fieldName}${kind}`,
  },
});
```
