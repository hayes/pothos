---
'@pothos/plugin-federation': patch
---

Add the `.js` extension to the `@apollo/subgraph/dist/types` import so the published ESM build loads on Node. `@apollo/subgraph` ships no `exports` map and Node's ESM resolver does not guess extensions, so importing `@pothos/plugin-federation` from an ESM package failed with `ERR_MODULE_NOT_FOUND` on 4.4.3 through 4.5.0. CJS was unaffected.
