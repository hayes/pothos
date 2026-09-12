---
"@pothos/plugin-mocks": patch
---

- Apply mocks defined for a concrete object type to fields inherited from an interface
- Ignore built-in prototype members (`toString`, `constructor`, ...) when looking up mocks, so
  fields that are not explicitly mocked keep their original resolvers. Mocks provided through a
  Proxy or a user defined prototype continue to work
