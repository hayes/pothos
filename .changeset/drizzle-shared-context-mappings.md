---
'@pothos/plugin-drizzle': patch
---

Operations or subscription events that share a context no longer resolve a filtered relation from rows loaded outside the plan, which could include rows the filter excludes. Operations sharing a context also no longer reload rows with a selection planned for another operation. Under graphql-jit, relations a query planned no longer load again for every row. Subscription events no longer resolve relations from what their `subscribe` planned, so an event whose payload `subscribe` loaded with `queryFromInfo` now reloads its relations like any other event. A `nestedSelection` path that doesn't fit the field's type now reaches clients as `Unexpected error.`, with the detail in the error's `cause`.
