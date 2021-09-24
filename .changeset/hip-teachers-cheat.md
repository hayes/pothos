---
'@giraphql/converter': patch
'@giraphql/core': patch
'@giraphql/plugin-validation': patch
'@giraphql/test-utils': patch
---

Fix a bug in argMapper that caused mappings to be omitted if the only mappings were for fields for
input types without nested mappings
