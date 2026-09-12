---
"@pothos/plugin-directives": patch
---

- Allow directives declared for multiple locations to be used in the ordered (array) directive format
- Expand repeated directive args (`{ tag: [argsA, argsB] }`) into one directive per args object when converting to the ordered format, both when merging `extensions.directives` with the `directives` option and when only one of them is provided. Previously the unmerged case produced a single directive whose args were the whole array, printing as `@tag(0: ..., 1: ...)`
- Support directives whose name shadows an `Object.prototype` member (eg. `constructor`) in the unordered format
