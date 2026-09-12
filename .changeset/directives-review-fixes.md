---
"@pothos/plugin-directives": patch
---

- Allow directives declared for multiple locations to be used in the ordered (array) directive format
- Flatten repeated directive args when merging unordered directive extensions with ordered directive options
- Support directives whose name shadows an `Object.prototype` member (eg. `constructor`) in the unordered format
