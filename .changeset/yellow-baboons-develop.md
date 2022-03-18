---
'@pothos/plugin-relay': minor
---

Explicitly make `cursor` non nullable. Previously `cursor` was nullable for
`defaultFieldNullability: true`, which is against the Relay spec. You can revert back to previous
behavior by updating your builder relay options:

```
relay: {
  cursorFieldOptions: {
    nullable: true,
  },
},
```
