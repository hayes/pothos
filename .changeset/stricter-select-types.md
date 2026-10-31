---
'@pothos/plugin-prisma-next': patch
---

Check and type type-level `select` on `prismaObject`, `prismaInterface` and `prismaNode`, reject unknown keys in field-level object selects and unknown relations on variant models, type selected required to-one relations as non-null, accept variant refs as relation `type`s, reject bytes cursor columns in types, and resolve qualified models in `relatedConnection` and connection helper callbacks.
