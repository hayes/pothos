# GiraphQL

A strongly typed code first schema builder for GraphQL

## Getting started

```typescript
import SchemaBuilder from '@giraphql/core'

const builder = new SchemaBuilder<{
  Object: {
    // backing models for User type
    User: { first: string; last: string };
  };
  Context: {},
}>()

const User = builder.createObject('User', {
  shape: t => ({
    firstName: t.exposeString('first', {}),
    lastName: t.exposeString('last', {}),
    fullName: t.string({
      resolve: parent => `${parent.first} ${parent.last}`
    }),
  }),
})

const Query = builder.createObject('Query', () => {
  shape: t =>({
    user: t.field({
      type: 'User',
      resolve: () => { first: 'Leia', last: 'Organa' }
    })
  })
})

const schema = builder.toSchema([Query, User])
```
