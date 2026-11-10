---
'@pothos/plugin-errors': patch
---

Forward subscription cancellation immediately to the source iterator, so unsubscribing from a quiet channel releases its pubsub listeners without waiting for another event. Close the source after a terminal subscription error as well.

Report invalid subscription sources and iterator results as errors instead of silently treating them as empty streams or events.

Use the shared core iterator for subscriptions and item-error lists, and close active nested lists when cancelled.

List cancellation is terminal: request source cleanup once and ignore cleanup yields, including nested lists offered during cleanup. Subscription iterators preserve the source's resumable cleanup behavior.
