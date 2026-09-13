---
"@pothos/plugin-relay": patch
---

Await each array edge before reading its node in nodesOnConnection. Promise-valued edges now produce the same nodes as the edges field, preserve nullable edges, and report rejected edges at their individual list positions.
