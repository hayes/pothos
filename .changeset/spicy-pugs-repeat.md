---
'@pothos/plugin-federation': minor
---

Add `FieldSet` type that can be used to define selections that can't be expressed with
`SelectionFromShape`, like selections with inline fragments on union or interface fields:

```ts
builder.selection<{ media: Media[] }>(
  'media { ... on Image { url } ... on Video { url } }' as FieldSet<{ media: Media[] }>,
)
```
