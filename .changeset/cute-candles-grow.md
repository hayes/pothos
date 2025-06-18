---
"@pothos/plugin-errors": minor
---

fieldNames are no longer capitalized before being passed to naming functions in the errors plugin. This behavior was a bug, but this change may cause some schema name changes who configured custom naming functions in their builder options for the errors plugin
