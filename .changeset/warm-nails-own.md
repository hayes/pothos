---
'@pothos/plugin-prisma-utils': minor
---

This change adds new methods for creating create and update input types

These new features require enabling a new flag in the pothos generator in your `prisma.schema`

```
generator pothos {
  provider     = "prisma-pothos-types"
  // Enable prismaUtils feature
  prismaUtils  = true
}
```

See the update README.md for full details
