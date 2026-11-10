---
"@pothos/plugin-smart-subscriptions": patch
---

Clean up sources created after asynchronous subscription cancellation and coordinate same-name replacements. Cancellation still returns without waiting for a subscribe promise that represents the stream lifetime; unsubscribe callbacks must tolerate repeated cleanup.
