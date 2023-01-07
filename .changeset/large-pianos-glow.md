---
'@pothos/plugin-with-input': minor
---

Add `name` option to `typeOptions` of`@pothos/plugin-with-input` to customize the default naming of
input fields.

An example usage of this:

```ts
import WithInputPlugin from '@pothos/plugin-with-input';
const builder = new SchemaBuilder({
  plugins: [WithInputPlugin],
  withInput: {
    typeOptions: {
      name: ({ parentTypeName, fieldName }) => {
        const capitalizedFieldName = `${fieldName[0].toUpperCase()}${fieldName.slice(1)}`;
        // This will remove the default Query/Mutation prefix from the input type name
        if (parentTypeName === 'Query' || parentTypeName === 'Mutation') {
          return `${capitalizedFieldName}Input`;
        }

        return `${parentTypeName}${capitalizedFieldName}Input`;
      },
    },
  },
});
```
