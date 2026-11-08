---
'@pothos/plugin-drizzle': patch
---

With graphql-js, graphql-jit or `@graphql-tools/executor` (Yoga), operations and subscription events that share a context no longer resolve a filtered relation from rows loaded outside the plan, which could include rows the filter excludes. This holds when a subscription publishes the same payload object twice, or yields its root value. Operations sharing a context also no longer reload rows with a selection planned for another operation. Under graphql-jit, relations a query planned no longer load again for every row. Subscription events no longer resolve relations from what their `subscribe` planned, so an event whose payload `subscribe` loaded with `queryFromInfo` now reloads its relations like any other event. A `nestedSelection` path that doesn't fit the field's type now reaches clients as `Unexpected error.`, with the detail in the error's `cause`.
