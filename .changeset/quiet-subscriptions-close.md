---
'@pothos/plugin-errors': patch
---

Fix cancellation of subscriptions and async item-error lists getting stuck behind a pending read. Also close active nested lists when their parent is cancelled, and close sources after iteration errors. Quiet pubsub subscriptions can release their listeners without waiting for another event.

Report invalid subscription sources and iterator results as errors instead of empty streams or events.
