---
'@pothos/plugin-errors': minor
---

Add `t.errorUnionField()` and `t.errorUnionListField()` methods for returning multiple success types alongside error types without wrapper types.

These new field builder methods provide a more flexible alternative to the `errors` option when you need to return multiple success types in a flat union

