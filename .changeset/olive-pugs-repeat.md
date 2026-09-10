---
'@pothos/plugin-relay': patch
---

Fix pageInfo flags when a connection is asked for a page size of 0. A backward page requested with
`last: 0` was treated as a forward page, so `hasNextPage` and `hasPreviousPage` came back reversed.
`first: 0` combined with a `before` cursor (or with `last`) was likewise treated as a backward page.
