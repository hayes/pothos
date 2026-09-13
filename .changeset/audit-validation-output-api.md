---
'@pothos/plugin-validation': patch
---

Remove the accidental output FieldRef.validate method, which never ran validation and incorrectly changed the inferred result type. Use input validation chains or an output field's validate option to validate its arguments.
