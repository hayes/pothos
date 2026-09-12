---
"@pothos/plugin-smart-subscriptions": patch
---

Fix refetching objects in lists resolved to non-array iterables (eg. a Set or a generator), which previously threw instead of updating

Attempt every unsubscribe when a subscription is cleaned up, instead of stopping at the first rejection and leaking the remaining subscriptions
