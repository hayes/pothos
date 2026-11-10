---
'@pothos/core': minor
---

Add `mapAsyncIterator` for mapping asynchronous resolver values while forwarding iterator cancellation immediately.

Preserve source method arguments and terminal results. Values yielded during `return()` or a recoverable `throw()` are mapped, and the source remains available for continuation. Release source and callback references on terminal completion or failure.
