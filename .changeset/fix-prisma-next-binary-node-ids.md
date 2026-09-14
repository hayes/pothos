---
"@pothos/plugin-prisma-next": patch
---

Match binary node IDs by their byte content so distinct Buffer IDs load the correct records and Uint8Array IDs round trip through node lookups. Preserve custom ID parser and resolver matching.
