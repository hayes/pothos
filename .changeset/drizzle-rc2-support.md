---
'@pothos/plugin-drizzle': patch
---

Support drizzle-orm@1.0.0-rc.2. The `_` shape on Drizzle clients dropped the
`schema`, `fullSchema`, and `tableNamesMap` properties; the plugin's
`DrizzleClient` type has been narrowed to only require `relations`, which is the
only field it actually reads.
