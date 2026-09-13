---
"@pothos/plugin-smart-subscriptions": patch
---

Route synchronous filter and cache-invalidation failures through subscription error handling. A thrown callback now rejects the pending iterator and removes event listeners instead of escaping into the event producer and leaving the subscription open.
