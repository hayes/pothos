# @pothos/plugin-drizzle

## 0.16.2

### Patch Changes

- ab0af70: Update to support drizzle-orm 1.0.0-beta.10

## 0.16.1

### Patch Changes

- 9993d01: Fix a bug where selecting only connection count at the same time as another field selected the same relation would cause an error"

## 0.16.0

### Minor Changes

- 3509aab: Add new field builder methods and connection enhancements:
  - `t.relatedField`: New method for creating custom fields based on relations with custom selections using the `buildFilter` callback
  - `t.relatedCount`: Simplified method for counting related records, with optional `where` filter support
  - `totalCount: true` option for `relatedConnection`: Adds a `totalCount` field to related connections
  - `totalCount` callback for `drizzleConnection`: Allows adding a `totalCount` field to drizzle connections
  - `totalCountOnly` optimization: Skips the main query when only `totalCount` is requested (for both connection types)

## 0.15.0

### Minor Changes

- 27d5aae: Fix mappings when merging selections across fragments

## 0.14.0

### Minor Changes

- 2a582ac: Update for drizzle@1.0.0-beta.2

## 0.13.0

### Minor Changes

- ede7c1d: Improve typing of query argument for drizzleField and drizzleConnection

### Patch Changes

- 3403c66: update dependencies

## 0.12.1

### Patch Changes

- e229f0e: Fix bug that incorrectly resolved table names when typescript and db names did not match

## 0.12.0

### Minor Changes

- 64e6e55: Update types to work with latest beta release

## 0.11.2

### Patch Changes

- 99ffc20: Fix column selection logic when merging selections
  - When `select` on Types and Fields does not contain `columns` no additional columns are selected
  - All nested selections (in `with`) match drizzle query API, where no explicit `columns` means all columns are selected
  - Inferred types now correctly match the selection logic above

## 0.11.1

### Patch Changes

- 517b559: Improve types when replace resolve definitions

## 0.11.0

### Minor Changes

- 12713e5: improve handling of iterable connections

### Patch Changes

- 12713e5: Fix parent type for builder.drizzleObjectField(s)

## 0.10.6

### Patch Changes

- 111ac8c: Fix relay options for drizzleNodes

## 0.10.5

### Patch Changes

- 1622740: update dependencies

## 0.10.4

### Patch Changes

- d5e9505: Fix resolution for alias primaryKey columns

## 0.10.3

### Patch Changes

- 0046a00: Correctly pass parent in connection results

## 0.10.2

### Patch Changes

- 0a1973e: fix drizzleInterfaceFields and interface variants

## 0.10.1

### Patch Changes

- 192c9c4: fix typing for ref on relatedFields and node variants

## 0.10.0

### Minor Changes

- 73a4c4e: Allow implementing entry connections with drizzleConnectionHelper

### Patch Changes

- 31e8c53: Fix default selection for drizzleObjects and nodes

## 0.9.0

### Minor Changes

- f350ef2: Update all APIs to use RQBV2

  ## RQBV2 Changes

  Please refer to https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v1-v2 and https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v2 for detailed instructions on setting up drizzle to use the RQBV2 API.

  This currently requires installing `drizzle-orm@beta`

  ## Pothos breaking changes

  ### Setup

  Setting up the plugin now requires the drizzle `relations` instead of the `schema`, as well as the `getTableConfig` function for your sql dialect:

  ```
  import { drizzle } from 'drizzle-orm/...';
  // Import the appropriate getTableConfig for your dialect
  import { getTableConfig } from 'drizzle-orm/sqlite-core';
  import SchemaBuilder from '@pothos/core';
  import DrizzlePlugin from '@pothos/plugin-drizzle';
  import { relations } from './db/relations';

  const db = drizzle(client, { relations });

  type DrizzleRelations = typeof relations

  export interface PothosTypes {
    DrizzleRelations: DrizzleRelations;
  }

  const builder = new SchemaBuilder<PothosTypes>({
    plugins: [DrizzlePlugin],
    drizzle: {
      client: db, // or (ctx) => db if you want to create a request specific client
      getTableConfig,
      relations,
    },
  });
  ```

  ### Where and OrderBy

  The `where` and `orderBy` options have changed to match the RQBv2 API:

  ```diff
      builder.drizzleObject('users', {
      name: 'User',
      fields: (t) => ({
          posts: t.relation('posts', {
          query: (args) => ({
  -            where: (post, { eq }) => eq(post.published, true),
  +            where: {
  +                published: true,
  +            },
  -            orderBy: (post, { desc }) => desc(post.updatedAt),
  +            orderBy: {
  +                updatedAt: 'desc',
  +            },
          }),
          }),
      }),
      });
  ```

  ### extras

  `extras` no-longer require a `.as(name)` call, but must use a callback style to reference table columns:

  ```diff
  const UserRef = builder.drizzleObject('users', {
    name: 'User',
    select: {
      extras: {
  -      lowercaseName: sql<string>`lower(${users.firstName}).as('lowercaseName')`
  +      lowercaseName: (users, sql) => sql<string>`lower(${users.firstName})`
      },
    },
  });
  ```

  ### Other stuff

  This release contains many other bug fixes, dozens of new tests, and a new `drizzleConnectionHelpers` API.

### Patch Changes

- cd7f309: Update dependencies

## 0.8.1

### Patch Changes

- 0f2a64e: fix issue with staged queries not being reset correctly after executing

## 0.8.0

### Minor Changes

- 2c0e072: Skip querying field selections within `@defer`red fragments

## 0.7.2

### Patch Changes

- d874bce: Improve inference of multiple interfaces

## 0.7.1

### Patch Changes

- c1db173: Fix error plugin compatability

## 0.7.0

### Minor Changes

- 9cfb6a7: cache input mappings accross resolvers to reduce memory ussage in large schemas

## 0.6.0

### Minor Changes

- 4315edc: Export Object ref type in drizzle plugin

## 0.5.3

### Patch Changes

- 67295e5: Fix drizzle cursors skipping first node after a cursor

## 0.5.2

### Patch Changes

- c71b6bd: fix: drizzle plugin model loader when multiple models are requested

## 0.5.1

### Patch Changes

- 52a70e9: Load client when db request is initialized rather than caching on model loader

## 0.5.0

### Minor Changes

- aadc82c: export client cache so it can be reset during request

## 0.4.7

### Patch Changes

- e98383b: use getMappedArgumentValues to improve relay compatibility

## 0.4.6

### Patch Changes

- 0aadded: improve handling of null cursor values

## 0.4.5

### Patch Changes

- bc73a7b: Fix table types for queries on relations to aliased tables

## 0.4.4

### Patch Changes

- 6dbe790: fix drizzleField list types

## 0.4.3

### Patch Changes

- fa2429f: Fix drizzleFieldWithInput

## 0.4.2

### Patch Changes

- cc5f993: Fix cursors using aliased coluns

## 0.4.1

### Patch Changes

- a6d105b: fix aliased table relations

## 0.4.0

### Minor Changes

- e6a3fb8: Fix query being required, and improve node IDs

## 0.3.0

### Minor Changes

- fc44ea7: Strip path prefixes in built code

## 0.2.1

### Patch Changes

- 0a94d29: Handle parsing of table config in config utils

## 0.2.0

### Minor Changes

- 566ca22: Add option to initialize drizzle client with context

## 0.1.0

### Minor Changes

- 27af377: replace eslint and prettier with biome

## 0.0.1

### Patch Changes

- dd2e758: Initial preview release
