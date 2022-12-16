---
'@pothos/plugin-relay': patch
---

Fix a bug where the `t.connection` helper wasn't correctly inferring the shape of the returned
connection object when used on interfaces.
