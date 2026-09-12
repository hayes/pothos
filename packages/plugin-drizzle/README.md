# Drizzle Plugin for Pothos

> **Note:**
This plugin uses drizzle's [relational query builder v2](https://orm.drizzle.team/docs/rqb-v2),
  which ships in `drizzle-orm` 1.0. That release is still a release candidate, and npm's `latest`
  tag is the 0.x line, so install drizzle with the `rc` tag. Its API can still change before 1.0 is
  final.

  If you are upgrading from an older version of this plugin, read drizzle's [relations v1 to v2
  guide](https://orm.drizzle.team/docs/relations-v1-v2), then this package's changelog for the
  Pothos specific changes.


The Drizzle plugin maps database tables to GraphQL types and plans database queries from the
fields a client selects. It supports relations, computed fields, and Relay nodes and connections.

The examples use authors and posts to demonstrate the plugin APIs.

### Getting started

[Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup) connects your Drizzle client to Pothos.
[Objects](https://pothos-graphql.dev/docs/plugins/drizzle/objects) covers type definitions and fields such as this lookup:

```typescript
builder.queryType({
  fields: (t) => ({
    author: t.drizzleField({
      type: 'users',
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) => {
        return db.query.users.findFirst(
          query({
            where: { id: args.id },
          }),
        );
      },
    }),
  }),
});
```

```graphql
query AuthorPage {
  author(id: 1) {
    fullName
    posts {
      title
    }
  }
}
```

The resolver passes Pothos's selection plan to Drizzle, loading the requested posts with their
author. Adding GraphQL fields does not require rewriting this root resolver.

[Relations](https://pothos-graphql.dev/docs/plugins/drizzle/relations) covers filtering and counts; [Selections](https://pothos-graphql.dev/docs/plugins/drizzle/selections) explains computed
fields and profiles; [Connections](https://pothos-graphql.dev/docs/plugins/drizzle/connections) handles pagination. [Variants](https://pothos-graphql.dev/docs/plugins/drizzle/variants) and
[Interfaces](https://pothos-graphql.dev/docs/plugins/drizzle/interfaces) keep private account data separate from public authors. For more
specialized schemas, [Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers) and [Async selections](https://pothos-graphql.dev/docs/plugins/drizzle/async-selections)
cover custom pagination and asynchronous planning.

## Setup

Pass your existing Drizzle client and relations to the plugin. These guides assume familiarity
with Drizzle; use its [driver setup](https://orm.drizzle.team/docs/connect-overview) and
[relations documentation](https://orm.drizzle.team/docs/relations-v2) to configure the database.

### Installing

```package-install
npm install --save @pothos/plugin-drizzle
```

The plugin requires Drizzle's relational query builder v2. See the
[version requirements](https://pothos-graphql.dev/docs/plugins/drizzle) before installing or upgrading Drizzle.

### Configure the builder

```ts
// builder.ts

export interface PothosTypes {
  DrizzleRelations: typeof relations;
  Context: { userId: number };
}

export const builder = new SchemaBuilder<PothosTypes>({
  plugins: [DrizzlePlugin],
  drizzle: { client: db, getTableConfig, relations },
});
```

`DrizzleRelations` provides the table and relation types used by Pothos. Import `getTableConfig`
from the dialect used by your client (`sqlite-core` above, or `pg-core` / `mysql-core`). `client`
may also be a function `(ctx) => db` for a request-specific client. The examples use
[request context](https://pothos-graphql.dev/docs/guide/context) to supply the current `userId`.

Use this builder to [define GraphQL types and fields](https://pothos-graphql.dev/docs/plugins/drizzle/objects), then call `builder.toSchema()`.

### Integration with other plugins

Install and register `@pothos/plugin-relay` to use `drizzleNode` and connection fields:

```ts

// In the builder options:
plugins: [RelayPlugin, DrizzlePlugin],
relay: { nodesOnConnection: true },
```

`nodesOnConnection` adds the `nodes` convenience field used in these guides. Without it,
select `edges { node { ... } }` instead.

The [with-input plugin](https://pothos-graphql.dev/docs/plugins/with-input) is another optional integration. To use
`t.drizzleFieldWithInput`, install `@pothos/plugin-with-input`, import it, and add it to the
builder's plugins:

```ts

// In the builder options:
plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
```

### Plugin options

- `client`: the drizzle client, or a function returning one from the request context.
- `getTableConfig`: the `getTableConfig` of your dialect, used to read primary keys and unique
  constraints.
- `relations`: the relations passed to `drizzle()`.
- `defaultConnectionSize` / `maxConnectionSize`: the page size a connection uses when the query
  does not ask for one (defaults to 20), and the largest size it will accept (defaults to 100).
  Both can also be set per field with `defaultSize` and `maxSize`.
- `filterConnectionTotalCount`: see [Connection totalCount](https://pothos-graphql.dev/docs/plugins/drizzle/connections#connection-totalcount).
- `skipDeferredFragments`: selections inside a `@defer` fragment are left out of the planned query
  by default, and the fragment's fields are loaded through [fallback queries](https://pothos-graphql.dev/docs/plugins/drizzle/relations#fallback-queries)
  when it resolves. Set this to `false` to plan deferred selections with the rest of the query.

## Drizzle Objects

Use the [configured builder](https://pothos-graphql.dev/docs/plugins/drizzle/setup) to map a Drizzle table to a GraphQL type. Defining a type
registers its fields; a root lookup makes them queryable.

### Defining Objects

The `builder.drizzleObject` method can be used to define GraphQL Object types based on a drizzle
table:

```ts
const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
  }),
});
```

You will be able to "expose" any column in the table, and GraphQL fields do not need to match the
names of the columns in your database. The returned `User` can be used like any other `ObjectRef`
in Pothos.

The example uses `builder.drizzleNode`, which adds a Relay ID and node refetching to the
same object API. See [Relay](https://pothos-graphql.dev/docs/plugins/drizzle/relay) for node IDs and refetching.

### Custom fields

A GraphQL field can combine several columns. The author’s full name declares both columns in
its selection and computes the string from the loaded row:

```typescript
fullName: t.string({
  select: { columns: { firstName: true, lastName: true } },
  resolve: (user) => `${user.firstName} ${user.lastName}`,
}),
```

This field belongs in User's `fields` callback. With the default type selection, all scalar
columns are available; with `select: {}`, computed fields must declare what they read.
[Selections](https://pothos-graphql.dev/docs/plugins/drizzle/selections) explains when those columns and relations are loaded.

### Drizzle Fields

`t.drizzleField` can return a Drizzle object from Query or from any other object type. Its
resolver receives a `query` function before the usual resolver arguments. Call that function and
pass its result to `findFirst` or `findMany`: it merges your filters and ordering with the
requirements of the GraphQL selection.

#### A nullable author lookup

The author page accepts an integer ID. A missing author returns null, matching the result of
`findFirst` and the field's `nullable: true` option:

```typescript
builder.queryType({
  fields: (t) => ({
    author: t.drizzleField({
      type: 'users',
      nullable: true,
      args: { id: t.arg.int({ required: true }) },
      resolve: (query, _root, args) => {
        return db.query.users.findFirst(
          query({
            where: { id: args.id },
          }),
        );
      },
    }),
  }),
});
```

`author(id: 1) { fullName }` returns Maya Chen. `author(id: 999) { fullName }` returns null.
Adding `posts { title }` loads the public posts through the same root resolver.

For a list field, use `type: ['users']` and `db.query.users.findMany(query())`. A plain lookup
without arguments can pass no options to `query`; fields with filters pass those options to it.

#### `drizzleFieldWithInput`

With the [with-input plugin](https://pothos-graphql.dev/docs/plugins/with-input),
`t.drizzleFieldWithInput` combines `t.drizzleField` with `t.fieldWithInput`. The `input` fields
become an input object argument, and the resolver still receives the `query` function as its first
argument. This alternative adds an `authorWithInput` lookup to the same public User type.
Install and register WithInputPlugin as described in [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins):

```ts
builder.queryFields((t) => ({
  authorWithInput: t.drizzleFieldWithInput({
    type: 'users',
    nullable: true,
    input: {
      id: t.input.int({ required: true }),
    },
    resolve: (query, root, args, ctx) => {
      return db.query.users.findFirst(
        query({
          where: { id: args.input.id },
        }),
      );
    },
  }),
}));
```

## Relations

`t.relation` turns a Drizzle relation into a GraphQL field with its target type and cardinality.
Register the target GraphQL type as well as the relation.

### Published posts and profiles

The public author page returns published posts. Drafts belong on the [private Viewer](https://pothos-graphql.dev/docs/plugins/drizzle/variants),
so the filter belongs on the relation wherever User can be reached:

```typescript
posts: t.relation('posts', {
  args: { oldestFirst: t.arg.boolean() },
  query: (args) => ({
    where: { published: true },
    orderBy: {
      createdAt: args.oldestFirst ? 'asc' : 'desc',
      id: args.oldestFirst ? 'asc' : 'desc',
    },
  }),
}),
```

The filter applies whenever this User type is queried. An author with no matching posts returns
an empty list. The `oldestFirst` argument selects the ordering.

To return the Profile object, register its GraphQL type and use `t.relation('profile')`. To
return only its nullable biography, use a [field selection](https://pothos-graphql.dev/docs/plugins/drizzle/selections#only-load-a-profile-when-requested).

### Relation queries

`query` accepts a static object or a callback that converts field arguments into Drizzle query
options. Alongside filters and ordering, a relation may use `limit` and `offset`. For example,
this alternative adds offset pagination to the public posts field:

```ts
posts: t.relation('posts', {
  args: { limit: t.arg.int(), offset: t.arg.int() },
  query: (args) => ({
    limit: args.limit ?? 10,
    offset: args.offset ?? 0,
    where: { published: true },
    orderBy: { createdAt: 'desc', id: 'desc' },
  }),
}),
```

The query API enables you to define args and convert them into parameters that will be passed into
the relational query builder. The `query` callback receives `(args, ctx, pathInfo)` where `pathInfo`
describes where in the GraphQL query the relation is being loaded:

- `path`: a list of `ParentType.fieldName` strings, from the root field down to the field being
  resolved (eg. `['Query.user', 'User.posts']`).
- `segments`: one object per entry in `path`, with `field` (the field name), `alias` (the alias used
  in the query, or the field name if none), `parentType` (the name of the type the field is defined
  on), and `isList` (whether the field returns a list).

You can read more about the relation query builder api
[here](https://orm.drizzle.team/docs/rqb-v2)

### Fallback queries

A field whose data is not on the row it resolves from is loaded with a fallback query. This happens
when:

- The parent row was not loaded through a `t.drizzleField`, `t.relation`, or connection. This
  covers rows a resolver queried itself, and rows that came from somewhere else entirely.
- A `drizzleField` resolver did not pass the result of `query()` to drizzle.
- A relation's arguments conflict with a sibling selection of the same relation that was planned
  first.

Fallback queries are batched. Every row of a table that needs the same selection in the same tick
is loaded with one `findMany` filtered on the primary key, or on the first unique column for a
table that has no primary key, and the rows are matched back to their parents. If the query does
not return a row for a parent, because it was deleted since it was loaded, or never came from the
table, that field rejects with `Model users(1) not found`, where the value in parentheses is the
key that was looked up.

The [alias query](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning#compare-two-orderings-of-one-relation) demonstrates
this fallback: newest and oldest cannot share one loaded posts list.

### Related count

An author’s count must use the same publication filter as the list. Otherwise the number can
reveal that unpublished posts exist:

```typescript
postCount: t.relatedCount('posts', { where: eq(posts.published, true) }),
```

`t.relatedCount` returns the number of related rows without loading them. Without a `where`,
it counts all rows in the relation.

The `where` option accepts either a static SQL filter or a function that receives the field arguments
and context:

```ts

// In the User fields callback:
publishedPostsCount: t.relatedCount('posts', {
  args: {
    title: t.arg.string(),
  },
  where: (args, ctx) => {
    if (args.title) {
      return and(eq(posts.published, true), eq(posts.title, args.title));
    }

    return eq(posts.published, true);
  },
});
```

For a many-to-many relation (one defined with `.through(...)`), `t.relatedCount` counts distinct
related rows, so a row reachable through two junction rows counts once. A `t.relatedConnection`'s
`totalCount` counts the rows the connection pages over instead, which is one per junction row,
since that is what the relational query builder returns for the relation.


### Many-to-many relations

A post exposes attached Media objects even though the database stores an attachment row. The
`through` relation handles that join; Pothos exposes its target like any other relation:

```typescript
builder.drizzleObject('posts', {
  name: 'Post',
  select: {},
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    author: t.relation('author'),
    media: t.relation('media'),
    mediaConnection: t.relatedConnection('media', {
      query: { orderBy: { id: 'asc' } },
      totalCount: true,
    }),
  }),
});
export const Media = builder.drizzleObject('media', {
  name: 'Media',
  fields: (t) => ({ url: t.exposeString('url'), uploadedBy: t.relation('uploadedBy') }),
});
```

`t.relation` and `t.relatedConnection` expose the Media type directly; no GraphQL type for the
junction table is needed.

### Related field

The `t.relatedField` method allows you to define a field based on a relation that uses custom
selections, including aggregations like counts. This is useful when you want to expose derived data
from a relation without loading the full related records.

For a simple count, prefer `t.relatedCount`. Its equivalent using `t.relatedField` illustrates
how `buildFilter` restricts an expression to the parent's related rows:

```ts

builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // Count only this author’s published posts
    postsCount: t.relatedField('posts', {
      type: 'Int',
      // buildFilter creates the correct WHERE clause for the relation
      select: (buildFilter) => {
        return {
          extras: {
            postsCount: (parent) => {
              return db.$count(
                posts,
                and(buildFilter(parent), eq(posts.published, true)),
              );
            },
          },
        };
      },
      resolve: (user) => user.postsCount,
    }),
  }),
});
```

`buildFilter(parent)` includes the relation's join conditions and any filter defined on the
relation. Combine it with the conditions your field needs, then return the selected value from
`resolve`. Use this helper for custom expressions that `t.relatedCount` does not cover.

`t.relatedField` also accepts the normal field options (`description`, `deprecationReason`,
`extensions`, and options added by other plugins like `authScopes`). Its `resolve` may be async,
and receives the resolve `info` as its fourth argument.

## Selections

Selections describe the database data a GraphQL field needs. The example User starts with
`select: {}` so requesting one field does not load unrelated columns or a profile.

### Field selections

An exposed column, such as `t.exposeString('firstName')`, contributes its own selection. A custom
resolver must declare the columns it reads:

```typescript
fullName: t.string({
  select: { columns: { firstName: true, lastName: true } },
  resolve: (user) => `${user.firstName} ${user.lastName}`,
}),
```

### Only load a profile when requested

A biography is a string in GraphQL, but it comes from the optional profile relation. The field
selects that relation only when requested:

```typescript
bio: t.string({
  nullable: true,
  select: { with: { profile: true } },
  resolve: (user) => user.profile?.bio,
}),
```

A missing profile returns null. A name-only query does not load the profile; adding `bio` adds
the relation to the database query.

### Computed SQL values

The same mechanism supports SQL expressions through `extras`. For example, a field can select
`lowercaseName` only when the GraphQL operation requests it:

```typescript
lowercaseName: t.string({
  select: {
    extras: {
      lowercaseName: (users, { sql }) => sql<string>`lower(${users.firstName})`,
    },
  },
  resolve: (user) => user.lowercaseName,
}),
```

### Type selections

By default, a `drizzleObject` gives its resolvers access to all columns of the table. A type-level
`select` replaces that default and makes its selected data available to every field resolver.
This alternative always loads the name, profile, and expression:

```ts
const User = builder.drizzleObject('users', {
  name: 'User',
  select: {
    columns: {
      firstName: true,
      lastName: true,
    },
    with: {
      profile: true,
    },
    extras: {
      lowercaseName: (users, { sql }) => sql<string>`lower(${users.firstName})`
    },
  },
  fields: (t) => {
    return {
      fullName: t.string({
        resolve: (user, args, ctx, info) => `${user.firstName} ${user.lastName}`,
      }),
      bio: t.string({
        nullable: true,
        resolve: (user) => user.profile?.bio,
      }),
      lowercaseName: t.string({
        resolve: (user) => user.lowercaseName,
      }),
    };
  },
});
```

Any selections added to the type will be available to consume in all resolvers. Columns that are not
selected can still be exposed as before.

Use type selections for data required whenever the type is loaded, and field selections for data
needed by a particular field. Both are merged into the parent query; they do not make each field
an independent database query. See [Query planning](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning).

## Connections

Connection fields combine cursor pagination with Pothos's selection planning. Define the rows a
field may return; Pothos adds pagination constraints and selects the columns and relations
requested under each node. The same field supports forward and backward pagination.

Use `t.drizzleConnection` when your resolver queries the rows and `t.relatedConnection` for a
Drizzle relation. Both require the [Relay plugin](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins).

### Page through published posts

The feed returns published posts ordered by creation time. Its resolver passes the result of
`query()` to Drizzle, just as a `t.drizzleField` does:

```typescript
posts: t.drizzleConnection({
  type: 'posts',
  totalCount: () => {
    return db.$count(posts, eq(posts.published, true));
  },
  resolve: (query) => {
    return db.query.posts.findMany(
      query({
        where: { published: true },
        // Three posts share this timestamp. Pothos adds the primary key
        // to the cursor ordering, so traversing pages still visits each once.
        orderBy: { createdAt: 'desc' },
      }),
    );
  },
}),
```

Pothos uses the selected node fields to plan the database query, including the nested author.
It also adds the ordering columns needed for cursors, even when the client does not select them.
When creation times tie, Pothos appends a primary-key tie breaker so posts have distinct positions.
See [Ordering and cursors](https://pothos-graphql.dev/docs/plugins/drizzle/ordering-and-cursors) for other orderings and column requirements.

A client requests the first page with `first`:

```graphql
query PostFeed($after: String) {
  posts(first: 2, after: $after) {
    totalCount
    edges {
      cursor
      node {
        title
        author {
          fullName
        }
      }
    }
    pageInfo {
      endCursor
      hasNextPage
    }
  }
}
```

For the next page, pass the previous `endCursor` as `after`. To paginate backward, use `last`
and `before`, taking `before` from a page's `startCursor`:

```graphql
query PreviousPosts($before: String) {
  posts(last: 2, before: $before) {
    nodes {
      title
    }
    pageInfo {
      startCursor
      hasPreviousPage
    }
  }
}
```

Backward pagination retains the connection's declared ordering; it selects the preceding rows
rather than reversing the response. `nodes` is a convenience field enabled by
`relay: { nodesOnConnection: true }`. With the default Relay configuration, use `edges { node }`.

### Related connections

An author's `postsConnection` applies the same publication filter as the feed. `t.relatedConnection`
plans that relation from the parent selection without a custom resolver:

```typescript
postsConnection: t.relatedConnection('posts', {
  query: { where: { published: true }, orderBy: { createdAt: 'desc' } },
  totalCount: true,
}),
```

The `query` option accepts an object or a callback receiving field arguments and context, as it
does on `t.relation`. Connection `orderBy` accepts column names with `'asc'` or `'desc'`, or a
column or array of columns for ascending order. Pothos can invert these orderings when fetching
a backward page. The default ordering uses the table's primary key.

Both connection methods create Connection and Edge types. Pass additional options to customize
those types, as with the [Relay plugin's connection fields](https://pothos-graphql.dev/docs/plugins/relay).

### Connection totalCount

`totalCount` describes the matching rows across all pages. The author's `totalCount: true`
counts both published posts even when `first: 1` returns only one. Pothos loads the count only
when it is selected; a query for only `totalCount` does not load the related posts.

For `t.relatedConnection`, Pothos derives the count from the relation and its filter. For a root
`t.drizzleConnection`, supply a `totalCount` resolver, as the feed does above. Its filter must
match the rows returned by the connection. This resolver receives the usual
`parent`, `args`, `context`, and `info` arguments. A count-only root query skips the main resolver.

By default, a related count includes the `where` returned by the connection's `query`. Setting
`filterConnectionTotalCount: false` in the builder's `drizzle` options ignores that field filter
for counts. A filter on the Drizzle relation itself still applies. Keep the default for the
public author field: counting drafts would reveal data excluded by its publication filter.

For a many-to-many relation defined with `through`, the count matches the rows being paginated.
If two junction rows reach the same target, that target appears and is counted twice. This differs
from [`t.relatedCount`](https://pothos-graphql.dev/docs/plugins/drizzle/relations#related-count), which counts distinct related targets.

### Connections with custom edges

A direct many-to-many relation works with `t.relatedConnection`. When the attachment itself has
fields, such as a caption, the edge needs data from the junction row while its node represents
Media. [Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers) shows how to combine that mapping with selection
planning, pagination, and custom edge fields in one connection.

## Ordering and cursors

Connections page with a cursor that records where in the ordering the previous page ended. This
applies to `t.relatedConnection`, `t.drizzleConnection`, and `drizzleConnectionHelpers`.

### Tied timestamps in a feed

The [post connection](https://pothos-graphql.dev/docs/plugins/drizzle/connections#page-through-published-posts) orders by `createdAt`, which
can be identical for several posts. Pothos adds a primary-key tie breaker so each post has a
distinct position in the connection.

```typescript
posts: t.drizzleConnection({
  type: 'posts',
  totalCount: () => {
    return db.$count(posts, eq(posts.published, true));
  },
  resolve: (query) => {
    return db.query.posts.findMany(
      query({
        where: { published: true },
        // Three posts share this timestamp. Pothos adds the primary key
        // to the cursor ordering, so traversing pages still visits each once.
        orderBy: { createdAt: 'desc' },
      }),
    );
  },
}),
```

#### Unique orderings

`orderBy: { createdAt: 'desc' }` does not describe a unique ordering. Rows with the same timestamp
can be returned in a different order on each query, so paging through the connection may return a row
twice, or skip it.

Pothos adds the primary key to the ordering when the columns you provide are not already unique, so
this:

```ts
orderBy: { createdAt: 'desc' }
```

is queried as `createdAt desc, id desc`. You can add the tie breaker yourself if you want it in a
different position or direction:

```ts
orderBy: { createdAt: 'desc', id: 'asc' }
```

Orderings that already contain the primary key, or a unique column or constraint whose columns are
all marked `notNull()`, are used as provided. Nullable unique columns are not treated as unique,
because rows containing a `null` are still tied with each other. Uniqueness declared with
`uniqueIndex()` is not detected, so those orderings still get the primary key appended.

Pothos also recognizes composite primary keys declared with `primaryKey({ columns: [...] })`.
Primary-key columns are treated as non-null for ordering; ensure your database enforces that
constraint.

Nothing is appended when Pothos cannot find a key it can rely on, which means tables with no primary
key, and tables whose only unique column is nullable. Those connections keep the ordering you wrote,
so give them a tie breaker yourself.

#### Nullable ordering columns

A row whose ordering value is `null` cannot be paged past. `null` is not greater or less than
anything in SQL, so no row compares as coming after it and the next page comes back empty. The same
applies to an ordering expression that can evaluate to `null`.

Order by columns that are `notNull()`, or give the expression a real value to fall back to with
`coalesce`.

#### Cursor values and precision

A cursor stores the values your driver returned to JavaScript, and those values are compared against
the column when the next page is requested. If the value in the cursor is not the value the database
has, the comparison will not match the rows you expect.

This comes up with timestamps. `timestamp({ mode: 'date' })` returns a JavaScript `Date`, which only
holds milliseconds, while a Postgres `timestamptz` column stores microseconds. A row stored at
`.086068` produces a cursor containing `.086`, and `created_at < '.086'` does not match the other
rows in that millisecond, so they are never returned on any page.

There are two ways to avoid this.

The first is to map the column so the full value reaches JavaScript. `mode: 'string'` returns the
timestamp as text, with the microseconds intact:

```ts
export const posts = pgTable('posts', {
  id: serial('id').primaryKey(),
  createdAt: timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull(),
});
```

The cursor stores that text, and Postgres parses it back to the value it stored. The column is still
what gets ordered and compared, so an index on it is still used. The field is typed as a `string`
rather than a `Date`.

The second is to order by an expression that returns the full value, which lets you keep the `Date`
mapping:

```ts
builder.queryFields((t) => ({
  posts: t.drizzleConnection({
    type: 'posts',
    resolve: (query) => {
      return db.query.posts.findMany(
        query({
          extras: {
            createdAtExact: (table) =>
              sql`to_char(${table.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          },
          orderBy: { createdAtExact: 'desc' },
        }),
      );
    },
  }),
}));
```

#### Ordering by an expression

`orderBy` accepts the name of any extra declared in the same query. Pothos orders by the expression,
builds the cursor from the value it returns, and compares the expression when paging:

```ts
query({
  extras: { titleLength: (table) => sql`length(${table.title})` },
  orderBy: { titleLength: 'asc' },
})
```

Extras used this way should be written as a callback. Drizzle aliases the table it queries and passes
that alias to the callback, so an expression built from the imported table object will reference a
name the query does not have.

With `drizzleConnectionHelpers`, declare the extra in `query` rather than in `select`. Only `query`
is read when the ordering is resolved.

The expression also needs to sort in the same order its values compare. A timestamp formatted as
fixed width UTC text sorts the same way it does chronologically, but a local time or variable width
format does not, and will skip rows.

## Relay nodes

The Relay plugin supplies node IDs and cursor connections. Register it with Drizzle as shown in
[Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins); [Connections](https://pothos-graphql.dev/docs/plugins/drizzle/connections) covers pagination.

### Define a node

`builder.drizzleNode` uses the same fields and selections as `builder.drizzleObject`, and adds
an ID and a root node lookup. The example User uses its integer primary key:

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});
```

This minimal alternative shows the node options. The example User adds full name, profile,
and published posts to the same type. Other ID field options can be passed alongside `column`;
for a composite primary key, `column` can return a list of columns.

### Refetch a public author

The ID returned by User can be passed back to
`node` to fetch the author with a new selection:

```graphql
query RefetchAuthor {
  node(id: "VXNlcjox") {
    ... on User {
      fullName
      posts {
        title
      }
    }
  }
}
```

The operation uses the ID of User 1. The node
returns the same public fields as the author lookup, including only published posts.

### Authorize the node load path

> [!WARNING]
> Defining a node creates a direct lookup through `node` and `nodes`. These lookups bypass custom
> root resolvers, so permission checks or visibility filters on a list or parent field do not protect
> node refetches. An encoded global ID is an identifier, not proof of permission.
>
> Apply an access policy to node loading, the type, or its fields as appropriate. See
> [Authorizing Relay nodes](https://pothos-graphql.dev/docs/plugins/scope-auth/relay-nodes) for scope patterns and their limits.

The public User type here can be refetched by anyone. Its
[published-posts relation](https://pothos-graphql.dev/docs/plugins/drizzle/relations#published-posts-and-profiles) applies the publication filter
wherever User is reached, including through `node`. Post stays an ordinary Drizzle object;
defining a public feed does not also make individual drafts globally refetchable.

## Type variants

A variant gives another GraphQL representation to the same database row. The publishing API
uses public User fields for author pages and a private Viewer for the signed-in account.

The API has three parts:

- `variant` registers an additional type instead of naming the primary type with `name`.
- `t.variant` returns another representation of the same row.
- A relation's `type` option can select a variant using its returned object ref.

### A single object variant

Use `variant` to define Viewer alongside the primary User type. `t.variant('users')` exposes
the public representation of the same row:

```ts
const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  select: {},
  fields: (t) => {
    return {
      id: t.exposeID('id'),
      user: t.variant('users'),
      drafts: t.relation('posts', {
        query: {
        where: { published: false },
        orderBy: { createdAt: 'desc', id: 'desc' },
      },
      }),
    };
  },
});
```

### A viewer with role-specific fields

When viewer fields differ by role, Viewer can instead be an interface with object variants
for each role. The following definition uses this structure; [Interfaces](https://pothos-graphql.dev/docs/plugins/drizzle/interfaces) explains
its implementations:

```typescript
export const Viewer = builder.drizzleInterface('users', {
  variant: 'Viewer',
  select: { columns: { id: true, role: true } },
  resolveType: (user) => (user.role === 'editor' ? 'EditorViewer' : 'AuthorViewer'),
  fields: (t) => ({
    user: t.variant('users'),
    email: t.exposeString('email'),
    drafts: t.relation('posts', {
      query: { where: { published: false }, orderBy: { id: 'asc' } },
    }),
  }),
});
```

The root lookup uses the authenticated context ID. It does not accept an arbitrary author's ID:

```typescript
me: t.drizzleField({
  type: Viewer,
  nullable: true,
  resolve: (query, _root, _args, ctx) => {
    return db.query.users.findFirst(
      query({
        where: { id: ctx.userId },
      }),
    );
  },
}),
```

Maya (`userId: 1`) sees “Planning the spring exchange”; Leo (`userId: 2`) sees “Saving rainwater.”
The interface and variants describe the shapes; the root lookup restricts ownership. Public
author fields and post connections return published posts only.

### Conditionally expose another variant

The publishing User also exposes its Viewer conditionally. Define that field after Viewer is registered,
which avoids a circular reference between their definitions:

```typescript
builder.drizzleObjectField('users', 'viewer', (t) =>
  t.variant(Viewer, {
    select: { columns: { id: true } },
    isNull: (user, _args, ctx) => user.id !== ctx.userId,
  }),
);
```

The ownership check is essential: without it an arbitrary author's public row could reveal that
author's drafts. `isNull` makes the variant field null when its parent is another account.

A variant field accepts a `select` just like other fields. Here it loads `id` for the ownership
check; the target variant contributes the selections required by its own fields.

### Relation variants

To use a different representation of a related row, pass its object ref to `t.relation`'s `type`
option. The variant must represent the relation's target table. For example, this alternative
adds a compact PostSummary representation and selects it for a public author's posts:

```ts
const PostSummary = builder.drizzleObject('posts', {
  variant: 'PostSummary',
  fields: (t) => ({ title: t.exposeString('title') }),
});

builder.drizzleObjectField('users', 'postSummaries', (t) =>
  t.relation('posts', {
    type: PostSummary,
    query: {
      where: { published: true },
      orderBy: { id: 'asc' },
    },
  }),
);
```

Two variants selected for the same row have their type-level selections merged. Conflicting
relation arguments or extras can fail; see
[Conflicting selections between variants](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning#conflicting-selections-between-variants).

## Interfaces

### Interfaces

`builder.drizzleInterface` works like `builder.drizzleObject`. It can define the primary type
or a variant of a table. Here Viewer is a variant, leaving User as the public primary type.

### Define the interface

```typescript
export const Viewer = builder.drizzleInterface('users', {
  variant: 'Viewer',
  select: { columns: { id: true, role: true } },
  resolveType: (user) => (user.role === 'editor' ? 'EditorViewer' : 'AuthorViewer'),
  fields: (t) => ({
    user: t.variant('users'),
    email: t.exposeString('email'),
    drafts: t.relation('posts', {
      query: { where: { published: false }, orderBy: { id: 'asc' } },
    }),
  }),
});
```

`resolveType` uses the selected `role` discriminator and returns GraphQL type names. Returning
names avoids a circular reference between the interface and its implementations.

### Selecting a viewer implementation

```typescript
builder.drizzleObject('users', {
  variant: 'EditorViewer',
  interfaces: [Viewer],
  select: { columns: { id: true, role: true } },
  fields: (t) => ({ canReviewSubmissions: t.boolean({ resolve: () => true }) }),
});
builder.drizzleObject('users', {
  variant: 'AuthorViewer',
  interfaces: [Viewer],
  select: { columns: { id: true, role: true } },
});
```

The interface's `select` is planned whenever a field returns the interface. An implementation's
own selection is planned when a fragment narrows to it. Selections are not inherited; put data
required by an implementation in its selection as well. An implementation may select additional
columns or expressions for fields that do not belong on the interface.

Maya (`userId: 1`) resolves to EditorViewer with `canReviewSubmissions: true`. Leo (`userId: 2`)
resolves to AuthorViewer, so the editor fragment contributes no field. The interface describes
those result shapes; the authenticated root lookup enforces whose drafts are returned.

### Extending an interface

Fields can be added to an interface later with `builder.drizzleInterfaceField` and
`builder.drizzleInterfaceFields`, which take the interface ref (or the table name) like their
`drizzleObjectField(s)` counterparts:

```ts
builder.drizzleInterfaceFields(Viewer, (t) => ({
  publishedPosts: t.relatedConnection('posts', {
    query: { where: { published: true } },
  }),
}));
```

An object type implementing a drizzle interface must be based on the same table. A plain object
type that implements one is planned with the interface's table, so fragments on it will select the
relations it inherits.

## Query planning

This page describes how the plugin turns a GraphQL query into drizzle queries, which is worth
knowing when a schema issues more queries than you expect.

### How fields get their data

A field either reads its data from a row that has already been loaded, or runs a query of its own.

A field's `select` is planned into the query of the nearest ancestor that runs one: a
`t.drizzleField`, a `t.relation`, a connection, or a [fallback query](https://pothos-graphql.dev/docs/plugins/drizzle/relations#fallback-queries). The field
then reads what it needs off the loaded row, without a query of its own. A field runs its own query
when its `resolve` queries drizzle directly, and when the plugin issues a fallback query for a
relation that is missing from the row.

A field can do both. A `t.drizzleField`, or any other field with a `select`, nested under one of
those ancestors has its `select` planned into the parent's row, and still runs its own query when
it resolves.

A field-level `select` is merged into the same query as its siblings and the type-level selection,
rather than being kept separate for that field. Two selections of the same relation share a place
in that query only when their arguments (`where`, `orderBy`, `limit`, ...) match. When they differ,
the first one planned wins, and the other is loaded with a query of its own. A type-level `select`
is planned before any field's selection, no matter where they appear in the document, and fields
are planned in the order they are selected.

### Compare two orderings of one relation

A client may need both the newest and oldest published posts on one author page:

```graphql
query CompareOrderings {
  author(id: 1) {
    newest: posts {
      title
    }
    oldest: posts(oldestFirst: true) {
      title
    }
  }
}
```

The [published-posts field](https://pothos-graphql.dev/docs/plugins/drizzle/relations#published-posts-and-profiles) translates those arguments
into different database orderings. The two fields cannot reuse the same loaded
relation because their orderings differ. The additional ordering is loaded through a fallback
query.

In this example, selecting one ordering executes one SQL statement; selecting both executes
two. The number of GraphQL field resolvers does not determine the number of database queries.

```typescript
posts: t.relation('posts', {
  args: { oldestFirst: t.arg.boolean() },
  query: (args) => ({
    where: { published: true },
    orderBy: {
      createdAt: args.oldestFirst ? 'asc' : 'desc',
      id: args.oldestFirst ? 'asc' : 'desc',
    },
  }),
}),
```

### Nested selections

A `select` function receives `nestedSelection`, which plans the selection beneath the field for the
field's own type. It returns the query config for that table, or a `many` config for a list field.
Any keys you pass in are kept as they were given, so `columns` passed to `nestedSelection` will
still narrow the parent shape:

```ts
builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    previewPosts: t.field({
      type: ['posts'],
      select: (args, ctx, nestedSelection) => {
        return {
          // what the query selects on the posts, limited to one
          with: {
            posts: nestedSelection({
              where: { published: true },
              orderBy: { id: 'asc' },
              limit: 1,
            }),
          },
        };
      },
      resolve: (user) => user.posts,
    }),
  }),
});
```

`nestedSelection(query, path, type)` takes two more arguments:

- `path`: a list of field names, for selecting a field nested under the field's type. A segment can
  also be written as `{ name, type }` to pin the implementation the field must be found under.
- `type`: a member of an interface or union, to read the selection as that type.

The `nestedSelection` function also carries the `path` and `segments` of the field being planned,
which are described under [Relation queries](https://pothos-graphql.dev/docs/plugins/drizzle/relations#relation-queries).

### Async selections

When a selection depends on asynchronous request data, enable `AsyncSelections: true` and await
nested plans. [Async selections](https://pothos-graphql.dev/docs/plugins/drizzle/async-selections) covers the builder configuration, supported
callbacks, helper options, and errors caused by unsettled promises.

### Conflicting selections between variants

When a query selects two variants of one table for the same row, either with a fragment on each
under one field, or through a `t.variant` field, the plugin will throw a `PothosValidationError` if
their `select` options ask for the same relation with different arguments:

```
PothosValidationError: Type-level selections of Viewer and Admin conflict on relation "posts".
Move the relation arguments to a field-level select on one of the types.
```

The same applies to two variants defining the same `extras` key with different functions
(`... conflict on extra "lowercaseName"`). Both variants describe one row, so their `select`
options are merged into a single query.

To fix this, move the relation with its arguments, or the extra, into the `select` of the field
that needs it on one of the variants. A field-level selection that conflicts with what the row
already holds falls back to a query for that field, rather than failing the request.

## Connection helpers

An image can appear in several posts, with a different caption in each. The Media row describes
the image; the PostMedia row describes its attachment to a post. A connection can expose the
image as its node and the attachment's caption as an edge field:

```graphql
query PostAttachments {
  author(id: 1) {
    postsConnection(first: 1) {
      nodes {
        title
        attachments(first: 2) {
          edges {
            caption
            node {
              url
              uploadedBy {
                fullName
              }
            }
          }
          pageInfo {
            endCursor
            hasNextPage
          }
        }
      }
    }
  }
}
```

`t.relatedConnection` handles a relation whose rows are the connection's nodes. Use
`drizzleConnectionHelpers` with `t.connection` when the rows being paginated differ from those
nodes, or when you need to load the rows yourself. The helper supplies the selection, cursor,
and result handling that a normal Relay connection field does not have.

### Select the nodes through the attachment

Import `drizzleConnectionHelpers` from `@pothos/plugin-drizzle` and use the builder configured
with the Drizzle and Relay plugins. The helper targets `postMedia`. Its `select` uses
`nestedSelection()` to request the Media fields
selected beneath the connection's nodes; `resolveNode` returns that related Media row:

```typescript
const attachmentArgs = builder.args((t) => ({
  hasCaption: t.boolean({ defaultValue: false }),
}));

const attachments = drizzleConnectionHelpers(builder, 'postMedia', {
  args: () => attachmentArgs,
  query: (args) => ({
    orderBy: { id: 'asc' },
    where: args.hasCaption ? { caption: { isNotNull: true } } : {},
  }),
  select: (nestedSelection) => {
    return {
      columns: { caption: true },
      with: { media: nestedSelection() },
    };
  },
  resolveNode: (attachment) => attachment.media,
});
```

The connection orders and creates cursors from attachment IDs, not Media IDs. An image shared
by two posts can therefore have a different caption and connection position in each post.
The nested uploader selection is still planned from the requested Media fields.

The helper's `args` and `query` options define a `hasCaption` argument. When it is true, the
connection includes only attachments with a caption. Its default, false, includes all attachments.
`getArgs()` exposes that argument on the field, and `getQuery()` combines the filter and ordering
with the requested page and node selection.

### Add the connection and its edge fields

`Media` below is the object ref returned by `builder.drizzleObject('media', ...)`.
A normal `t.connection` needs an explicit `select` to load the helper's query on the parent.
Its resolver passes the selected attachment rows to the helper's `resolve` method:

```typescript
builder.drizzleObjectField('posts', 'attachments', (t) =>
  t.connection(
    {
      type: Media,
      args: attachments.getArgs(),
      select: (args, ctx, nestedSelection) => {
        return {
          with: {
            attachments: attachments.getQuery(args, ctx, nestedSelection),
          },
        };
      },
      resolve: (post, args, ctx) => {
        return attachments.resolve(post.attachments, args, ctx);
      },
    },
    {},
    {
      fields: (edge) => ({
        caption: edge.string({
          nullable: true,
          resolve: (attachment) => attachment.caption,
        }),
      }),
    },
  ),
);
```

The third argument to `t.connection` configures the Edge type. Each edge retains the selected
attachment fields, so its `caption` resolver reads the attachment's caption, while `node` returns
the Media selected by `resolveNode`. A missing caption returns null.

The post has three attachments. Its first unfiltered page of two has `hasNextPage: true`;
filtering to captioned attachments returns two and has no next page. Pagination uses the same
`first`/`after` and `last`/`before` arguments as [other connections](https://pothos-graphql.dev/docs/plugins/drizzle/connections#page-through-published-posts).

### Querying the rows in a resolver

The same helper can build a query for a resolver that fetches the attachment rows itself.
Pass GraphQL resolve `info` to `getQuery`, merge any additional filter with its cursor filter,
and pass the result to `resolve`:

```ts
// Alternative resolver for the Post.attachments connection above:
resolve: async (post, args, ctx, info) => {
  const query = attachments.getQuery(args, ctx, info);
  const attachmentRows = await db.query.postMedia.findMany({
    ...query,
    where: {
      AND: [query.where ?? {}, { postId: post.id }],
    },
  });

  return attachments.resolve(attachmentRows, args, ctx);
},
```

This alternative needs `db` imported from the application's database module and `id` selected
on Post. Remove the field's relation `select` when using it, so the rows are not also loaded
through the parent query. Replacing the helper's `where` rather than combining it would discard
pagination constraints.

If the rows and nodes are the same type, omit `resolveNode` and the node-mapping `select` when
creating the helper. Its `ref` provides the node type for `t.connection`. Prefer
`t.relatedConnection` when you can expose that relation directly without custom loading.

## Async selections

Pothos selections are synchronous by default. Set `AsyncSelections: true` when a selection or
relation query must await request data before returning its query options.

### Async selections

Use the client and relations configured in [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup). The context method below supplies
a preview size loaded asynchronously, for example from account settings:

```ts
const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
  AsyncSelections: true;
  Context: {
    previewSize: () => Promise<number>;
  };
}>({
  plugins: [DrizzlePlugin],
  drizzle: {
    client: db,
    getTableConfig,
    relations,
  },
});
```

With the opt-in, `select` functions, relation `query` callbacks, `relatedCount` `where` callbacks,
and the `select` and `query` callbacks of `drizzleConnectionHelpers` may be async. Without it they
are typed as synchronous, and an async callback is a type error.

Pothos waits for these callbacks before executing the planned query. `t.relation`, `t.relatedCount`,
`t.drizzleField`, `t.drizzleConnection` and `t.relatedConnection` settle their plan before the
resolver runs, and need no changes.

```ts
builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    previewPosts: t.field({
      type: ['posts'],
      select: async (args, ctx, nestedSelection) => {
        return {
          with: {
            posts: await nestedSelection({
              where: { published: true },
              orderBy: { id: 'asc' },
              limit: await ctx.previewSize(),
            }),
          },
        };
      },
      resolve: (user) => user.posts,
    }),
  }),
});
```

### Await nested selections

`await` what `nestedSelection` returns before putting it in the selection, and the same for the
`nestedQuery` passed as the fourth argument of a `t.relatedField` `select`. A selection that
contains the promise itself will throw, and so will a `select` that returns while a nested
selection it started is still pending. Include the nested selection in the returned query to
load its data.

### Connection helpers

Pass `awaitSelections: true` to `drizzleConnectionHelpers(...).getQuery`, and `await` the query it
returns. Without it, an async selection beneath the field throws, and whether there is one
depends on the incoming document rather than on the callback you wrote. A connection helper also
throws when its own `select` or `query` is async, whatever the document asked for:

```ts
select: async (args, ctx, nestedSelection) => {
  return {
    with: {
      attachments: await attachments.getQuery(args, ctx, nestedSelection, {
        awaitSelections: true,
      }),
    },
  };
},
```

`awaitSelections` is a per-call option, and is available whether or not the schema sets
`AsyncSelections`.

When `AsyncSelections: true`, also `await` a connection helper's `resolve()` before inspecting or
spreading its result: an async `query` callback makes resolution asynchronous. Returning its
result directly from a GraphQL resolver remains supported.

The connection-helper excerpt uses the Post attachments relation and `attachments` helper from
[Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers). Request-context
methods must be supplied by the application; they are not created by declaring the Context type.
