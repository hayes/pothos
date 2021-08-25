---
'@giraphql/plugin-prisma': minor
---

#### Breaking

- The Prisma plugin had been re-designed to use a prisma-generator to generate more efficient types.  This requires new additional setup
- Restored the original API that used model names as strings rather than passing in prisma delegates.

#### New

- Added support for `include` options on `prismaObject` and `prismaNode` types that are automatically loaded.  This allows fields defined directly on those types to use nested relations without making additional requests.
- Added `relationCount` method to prisma field builder and `totalCount` option to `relatedConnection` for more loading of counts.

### Fixed

- Fixed some bugs related to field nullability
- Improved include merging to further reduce the number of queries required to resolve a request
