---
'@pothos/core': minor
---

Add `withScalar` method to the schema builder to allow inference of Scalar typescript types from
`GraphQLScalarType` scalars

```typescript
const builder = new SchemaBuilder({}).withScalars({ Date: CustomDateScalar });
```
