---
"@pothos/plugin-relay": minor
---

Explicitly make `pageInfo` non nullable. Previously `pageInfo` was nullable for `defaultFieldNullability: true`, which is against the Relay spec.
You can revert back to previous behaviour by updating your builder relay options:
```
relay: {
  pageInfoFieldOptions: {
    nullable: true,
  },
},
```
