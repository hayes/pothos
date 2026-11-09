---
'@pothos/plugin-errors': patch
---

Forward subscription cancellation immediately to the source iterator, so unsubscribing from a quiet channel releases its pubsub listeners without waiting for another event. Close the source after a terminal subscription error as well.
