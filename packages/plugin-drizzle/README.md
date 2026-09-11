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

The guides follow a publishing API: public author pages show published posts, while the signed-in
account sees its own drafts. Posts can share media and clients can paginate the public feed.


### Getting started

[Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup) defines the tables, relations, client, and builder. [Objects](https://pothos-graphql.dev/docs/plugins/drizzle/objects) then
registers a public User and the author lookup:

```typescript
builder.queryType({});
builder.queryField('author', (t) =>
  t.drizzleField({
    type: 'users',
    nullable: true,
    args: { id: t.arg.int({ required: true }) },
    resolve: (query, _root, args) => db.query.users.findFirst(query({ where: { id: args.id } })),
  }),
);
```

```graphql
query AuthorPage {
  author(id: 1) {
    fullName
    posts { title }
  }
}
```

The query returns Maya Chen and her two published posts. The root resolver passes the selection
function to Drizzle, so the requested relation is loaded with the author. Adding an optional
biography uses the same lookup, with the additional selection declared by that field.

[Relations](https://pothos-graphql.dev/docs/plugins/drizzle/relations) covers filtering and counts; [Selections](https://pothos-graphql.dev/docs/plugins/drizzle/selections) explains computed
fields and profiles; [Connections](https://pothos-graphql.dev/docs/plugins/drizzle/connections) handles pagination. [Variants](https://pothos-graphql.dev/docs/plugins/drizzle/variants) and
[Interfaces](https://pothos-graphql.dev/docs/plugins/drizzle/interfaces) keep private account data separate from public authors. For more
specialized schemas, [Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers) and [Async selections](https://pothos-graphql.dev/docs/plugins/drizzle/async-selections)
cover custom pagination and asynchronous planning.

## Setup

The publishing API uses one set of tables for public author pages, private drafts, and media
attachments. Its GraphQL modules share one builder and one database client.

### Installing

```package-install
npm install --save @pothos/core @pothos/plugin-drizzle @pothos/plugin-relay graphql drizzle-orm@rc
```

The plugin uses Drizzle's relational query builder v2. Define the tables and relations your schema
will query; see Drizzle’s [relations API](https://orm.drizzle.team/docs/relations-v2).

### Publishing tables

The same table definitions support author profiles, published posts, private drafts, and shared
media. The join table prevents duplicate attachments:

```typescript
import { defineRelations } from 'drizzle-orm';
import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: integer().primaryKey(),
  firstName: text().notNull(),
  lastName: text().notNull(),
  email: text().notNull().unique(),
  role: text({ enum: ['editor', 'author'] }).notNull(),
});
export const profiles = sqliteTable('profiles', {
  id: integer().primaryKey(),
  userId: integer()
    .notNull()
    .unique()
    .references(() => users.id),
  bio: text(),
});
export const posts = sqliteTable('posts', {
  id: integer().primaryKey(),
  authorId: integer()
    .notNull()
    .references(() => users.id),
  title: text().notNull(),
  content: text().notNull(),
  published: integer({ mode: 'boolean' }).notNull(),
  createdAt: text().notNull(),
});
export const media = sqliteTable('media', {
  id: integer().primaryKey(),
  url: text().notNull(),
  uploadedById: integer()
    .notNull()
    .references(() => users.id),
});
export const postMedia = sqliteTable(
  'postMedia',
  {
    id: integer().primaryKey(),
    postId: integer()
      .notNull()
      .references(() => posts.id),
    mediaId: integer()
      .notNull()
      .references(() => media.id),
  },
  (table) => [unique().on(table.postId, table.mediaId)],
);
```

Relations explicitly connect their source and target columns. `media` crosses the join table,
while `profile` can be absent:

```typescript
export const relations = defineRelations({ users, profiles, posts, media, postMedia }, (r) => ({
  users: {
    profile: r.one.profiles({ from: r.users.id, to: r.profiles.userId }),
    posts: r.many.posts({ from: r.users.id, to: r.posts.authorId }),
  },
  profiles: { user: r.one.users({ from: r.profiles.userId, to: r.users.id, optional: false }) },
  posts: {
    author: r.one.users({ from: r.posts.authorId, to: r.users.id, optional: false }),
    media: r.many.media({
      from: r.posts.id.through(r.postMedia.postId),
      to: r.media.id.through(r.postMedia.mediaId),
    }),
  },
  media: {
    uploadedBy: r.one.users({ from: r.media.uploadedById, to: r.users.id, optional: false }),
  },
}));
```

### Database client

Use the Drizzle driver for your database. For a local SQLite application, install `@libsql/client`
and initialize the client with those relations:

```ts
// database.ts

const client = createClient({ url: 'file:./dev.db' });
export const db = drizzle({ client, relations });
```

Create the application's tables with your migration workflow before querying them. Opening the
client does not apply the table definitions to an existing database. For another dialect, use
its driver and the matching dialect's `getTableConfig` import in the builder.

### Configure the builder

```ts
// builder.ts

export interface PothosTypes {
  DrizzleRelations: typeof relations;
  Context: { userId: number };
}

export const builder = new SchemaBuilder<PothosTypes>({
  plugins: [RelayPlugin, DrizzlePlugin],
  relay: { nodesOnConnection: true },
  drizzle: { client: db, getTableConfig, relations },
});
```

`DrizzleRelations` describes the relations available to the plugin. `getTableConfig` provides
column and key information. `client` may also be a function `(ctx) => db` for a request-specific
client. The authenticated request context supplies `userId`; declaring its type does not
implement authentication. See [Context](https://pothos-graphql.dev/docs/guide/context).

Import this builder in the type and query modules. Register those modules before calling
`builder.toSchema()`; the publishing API separates User, Post, and Viewer definitions from its
root queries. [Objects](https://pothos-graphql.dev/docs/plugins/drizzle/objects) starts with the author lookup.

### Integration with other plugins

Relay is optional for Drizzle itself; the publishing API uses it for User nodes and connections.
`nodesOnConnection` adds the `nodes` convenience field alongside Relay's standard `edges`.

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

The publishing API uses the tables and builder from [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup). Its public User describes
an author; Post describes an article. Defining a type registers its fields, while a root lookup
makes those fields queryable.

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

The publishing User uses `builder.drizzleNode`, which adds a Relay ID and node refetching to the
same object API. See [Relay](https://pothos-graphql.dev/docs/plugins/drizzle/relay) for that choice. Its public fields omit email and drafts;
those belong on the current author's [Viewer](https://pothos-graphql.dev/docs/plugins/drizzle/variants).

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

### A nullable author lookup

The author page accepts an integer ID. A missing author returns null, matching the result of
`findFirst` and the field's `nullable: true` option:

```typescript
builder.queryType({});
builder.queryField('author', (t) =>
  t.drizzleField({
    type: 'users',
    nullable: true,
    args: { id: t.arg.int({ required: true }) },
    resolve: (query, _root, args) => db.query.users.findFirst(query({ where: { id: args.id } })),
  }),
);
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
    resolve: (query, root, args, ctx) =>
      db.query.users.findFirst(query({ where: { id: args.input.id } })),
  }),
}));
```

## Relations

### Relations

Relations connect the [publishing tables](https://pothos-graphql.dev/docs/plugins/drizzle/setup#publishing-tables): each post has an author,
an author has posts and an optional profile, and posts share media through an attachment table.
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

Maya's author page returns two published posts. Her draft is absent. Nora has no posts and gets
an empty list. The `oldestFirst` argument switches ordering; an ID tie breaker makes equal
timestamps deterministic.

The optional profile is exposed as a nullable `bio` field with a field-level selection; see
[Selections](https://pothos-graphql.dev/docs/plugins/drizzle/selections#only-load-a-profile-when-requested). An application that wants to expose
the Profile object instead can register a `profiles` type and use `profile: t.relation('profile')`.
Its `bio` column is nullable, so an exposed biography should set `nullable: true`.

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

The publishing [alias query](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning#compare-two-orderings-of-one-relation) demonstrates
this fallback: newest and oldest cannot share one loaded posts list.

### Related count

An author’s count must use the same publication filter as the list. Otherwise the number can
reveal that unpublished posts exist:

```typescript
postCount: t.relatedCount('posts', { where: eq(posts.published, true) }),
```

`t.relatedCount` returns the number of related rows without loading them. Maya's count is two,
and Nora's is zero. Without a `where`, it counts all rows in the relation.

The `where` option accepts either a static SQL filter or a function that receives the field arguments
and context:

```ts
publishedPostsCount: t.relatedCount('posts', {
  args: {
    title: t.arg.string(),
  },
  where: (args, ctx) => args.title
    ? and(eq(posts.published, true), eq(posts.title, args.title))
    : eq(posts.published, true),
});
```

For a many-to-many relation (one defined with `.through(...)`), `t.relatedCount` counts distinct
related rows, so a row reachable through two junction rows counts once. A `t.relatedConnection`'s
`totalCount` counts the rows the connection pages over instead, which is one per junction row,
since that is what the relational query builder returns for the relation.


The callback example uses `and` and `eq` from `drizzle-orm`, and the `posts` table from Setup.

### Shared media

A post exposes attached Media objects even though the database stores an attachment row. The
`through` relation in [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup#publishing-tables) handles that join:

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
builder.drizzleObject('media', {
  name: 'Media',
  fields: (t) => ({ url: t.exposeString('url'), uploadedBy: t.relation('uploadedBy') }),
});
```

“Starting a seed library” and “A guide to composting” share one image uploaded by Leo. The
attachment uniqueness constraint prevents attaching the same image to a post twice. The connection
counts its related media, rather than the entire media table.

### Related field

The `t.relatedField` method allows you to define a field based on a relation that uses custom
selections, including aggregations like counts. This is useful when you want to expose derived data
from a relation without loading the full related records.

#### Count aggregations

One common use case is adding a count field that efficiently counts related records:

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
      select: (buildFilter) => ({
        extras: {
          postsCount: (parent) => db.$count(posts, and(buildFilter(parent), eq(posts.published, true))),
        },
      }),
      resolve: (user) => user.postsCount,
    }),
  }),
});
```

The `buildFilter` function passed to `select` generates the appropriate SQL filter based on the
relation definition.  This is no different than using `t.field`, but the `buildFilter` helper makes
it easier to filter for the related records.

`t.relatedField` also accepts the normal field options (`description`, `deprecationReason`,
`extensions`, and options added by other plugins like `authScopes`). Its `resolve` may be async,
and receives the resolve `info` as its fourth argument.

#### SQLite many-to-many filters

On SQLite, `buildFilter` can look up related target identities through the junction join when the
target has a non-null unique key. PostgreSQL retains an `EXISTS` predicate to avoid an additional
target join.

For a custom `RAW` scope in a Drizzle relation definition, use the table supplied to the callback:

```ts
where: {
  RAW: (target) => sql`${target.published} = true`,
},
```

This lets Drizzle use the target's alias inside the lookup. A static SQL scope referencing the
original target table, such as ``RAW: sql`${posts.published} = true` ``, is passed through unchanged
and can still force SQLite to scan the target table. The same applies to a callback that ignores
its table argument and references `posts` directly. Object filters such as
`where: { published: true }` also use the supplied alias.

## Selections

Selections describe the database data a GraphQL field needs. The publishing User starts with
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

Maya has a biography; Nora has no profile, so her biography is null. A name-only query does not
load either author's profile. Adding `bio` adds the relation to the database query, and the
resolver reads the selected row.

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

By default, a `drizzleObject` gives its resolvers access to all columns of the table. For tables
with many columns, it can be more efficient to only select the needed columns. This alternative User definition always loads the name, profile, and expression together
by putting them in the type’s `select`:

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
  fields: (t) => ({
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
  }),
});
```

Any selections added to the type will be available to consume in all resolvers. Columns that are not
selected can still be exposed as before.


Use type selections for data required whenever the type is loaded, and field selections for data
needed by a particular field. Both are merged into the parent query; they do not make each field
an independent database query. See [Query planning](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning).

## Connections

The publishing API has a root feed and an author's related posts connection. Both filter to
published posts; pagination never expands that visibility scope. Register the [Relay plugin](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins).
The examples use `relay: { nodesOnConnection: true }`; with the default Relay configuration,
select `edges { node { title } }` instead of `nodes { title }`.

### Page through published posts

`t.drizzleConnection` adds a root connection. Its resolver receives a selection function just
like `t.drizzleField`, including the cursor and page-size requirements:

```typescript
posts: t.drizzleConnection({
  type: 'posts',
  resolve: (query) =>
    db.query.posts.findMany(
      query({
        where: { published: true },
        // Three posts share this timestamp. Pothos adds the primary key
        // to the cursor ordering, so traversing pages still visits each once.
        orderBy: { createdAt: 'desc' },
      }),
    ),
}),
```

There are three published posts and two drafts. The first page returns two published posts and
`hasNextPage: true`; a request with that `endCursor` as `after` returns the remaining post.
The feed orders by `createdAt`, and the plugin adds a primary-key tie breaker as described in
[Ordering and cursors](https://pothos-graphql.dev/docs/plugins/drizzle/ordering-and-cursors).

### Related connections

`t.relatedConnection` exposes a relation as a connection instead of a list. The author’s
`postsConnection` uses the same publication filter as `posts`:

```typescript
postsConnection: t.relatedConnection('posts', {
  query: { where: { published: true }, orderBy: { createdAt: 'desc' } },
  totalCount: true,
}),
```

This will automatically define the `Connection`, and `Edge` types, and their respective fields. To
customize the Connection and Edge types, options for these types can be passed as additional
arguments to `t.relatedConnection`, just like `t.connection` from the relay plugin. See the
[relay plugin docs](https://pothos-graphql.dev/docs/plugins/relay) for more details.

You can also define a `query` like with `t.relation`. The only difference with `t.relatedConnection`
is that the `orderBy` format is slightly changed.

To comply with the relay spec and efficiently support backwards pagination, some queries need to be
performed in reverse order, which requires inverting the orderBy clause. To do this automatically,
the `t.relatedConnection` method accepts orderBy as an object keyed by column name with `'asc'` or
`'desc'` values, like `{ createdAt: 'desc' }`, rather than using the `asc(column)` and
`desc(column)` helpers from drizzle. orderBy can also be returned as a single column, or an array of
columns when ordering by multiple columns, which orders ascending.

Ordering defaults to using the table `primaryKey`, and the orderBy columns will also be used to
derive the connections cursor.

### Connection totalCount

The author's `totalCount: true` counts both published posts even when the page contains only one.
A query asking for only `totalCount` still applies the publication filter.

This will automatically add a `totalCount` field to the connection type. The count query is only
executed when the `totalCount` field is actually requested in the GraphQL query, and it's included
as a subquery in the main database query for efficiency.

The count applies the `where` returned by the field's `query`, so it counts the same rows the
connection paginates (only published posts in the example above). To count every related row
regardless of the filter, set `filterConnectionTotalCount: false` in the `drizzle` plugin options:

```ts
const builder = new SchemaBuilder<PothosTypes>({
  plugins: [RelayPlugin, DrizzlePlugin],
  drizzle: {
    client: db,
    getTableConfig,
    relations,
    // count every related row for totalCount, ignoring the where from query (defaults to true)
    filterConnectionTotalCount: false,
  },
});
```

A `where` on the relation itself always applies to the count, as does the junction table of a
many-to-many relation defined with `.through(...)`. The count joins the junction table the same way
the rows do, so a row that matches the junction twice counts twice, and appears twice in the
connection.

The publishing API keeps the default filter behavior: disabling it would reveal an author's
unpublished post count through this public field.

### Drizzle connections

The root connection shown above uses the same ordering and cursor rules as related connections.
#### drizzleConnection totalCount

For a root `totalCount`, supply a resolver rather than `true`. This alternative extends the
published feed; import `eq` from `drizzle-orm` and `posts` from your table definitions:

```ts
builder.queryFields((t) => ({
  posts: t.drizzleConnection({
    type: 'posts',
    // Use db.$count() for a simple count query
    totalCount: () => db.$count(posts, eq(posts.published, true)),
    resolve: (query, root, args, ctx) =>
      db.query.posts.findMany(
        query({
          where: {
            published: true,
          },
          orderBy: {
            id: 'desc',
          },
        }),
      ),
  }),
}));
```

The `totalCount` callback receives the same arguments as a normal resolver (`parent`, `args`, `context`, `info`), allowing you to implement custom count logic based on the query context. The example above uses `db.$count()` for a simple count, but you can use any Drizzle query approach.

When only the `totalCount` field is requested (without `edges` or `nodes`), the main query is skipped entirely and only the count query is executed for efficiency.

### Indirect relations as connections

The publishing media relation uses `through`, so `t.relatedConnection` is sufficient. When edges
paginate join rows but nodes represent a different table, use [Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers#indirect-relations-as-connections).

#### Extending connection edges

[Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers#extending-connection-edges) shows how to expose a join
row's timestamp on an edge while returning the related object as its node.

#### `drizzleConnectionHelpers` for non-relation connections

For a manually queried connection, [merge its cursor filter with your application filter](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers#non-relation-connections).
Overwriting the helper's `where` loses the cursor constraints.

## Ordering and cursors

### Ordering and cursors

Connections page with a cursor that records where in the ordering the previous page ended. This
applies to `t.relatedConnection`, `t.drizzleConnection`, and `drizzleConnectionHelpers`.

### Tied timestamps in a feed

All three published posts in the [publishing schema](https://pothos-graphql.dev/docs/plugins/drizzle/connections#page-through-published-posts)
share one timestamp. Its connection orders by `createdAt: 'desc'`, so Pothos appends the primary
key in descending order. The first page returns “Watering through summer” and “A guide to
composting”; continuing from its end cursor returns “Starting a seed library” exactly once.

This example uses fixed-width UTC text with millisecond precision. It demonstrates ordering ties
without introducing a driver precision conversion; the Postgres precision guidance below still
applies when using timestamp columns.

```typescript
posts: t.drizzleConnection({
  type: 'posts',
  resolve: (query) =>
    db.query.posts.findMany(
      query({
        where: { published: true },
        // Three posts share this timestamp. Pothos adds the primary key
        // to the cursor ordering, so traversing pages still visits each once.
        orderBy: { createdAt: 'desc' },
      }),
    ),
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

Primary keys are used whether or not their columns are marked `notNull()`, since SQL makes primary
key columns non-nullable anyway. That includes composite keys declared with
`primaryKey({ columns: [...] })`.

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
    resolve: (query) =>
      db.query.posts.findMany(
        query({
          extras: {
            createdAtExact: (table) =>
              sql`to_char(${table.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`,
          },
          orderBy: { createdAtExact: 'desc' },
        }),
      ),
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

Ordering by an expression cannot use an index on the underlying column. If the table is large enough
to need one, add an index on the expression.

## Relay

### Relay integration

The Relay plugin supplies node IDs and cursor connections. Register it with Drizzle as shown in
[Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins); [Connections](https://pothos-graphql.dev/docs/plugins/drizzle/connections) covers pagination.

### Relay Nodes

`builder.drizzleNode` uses the same fields and selections as `builder.drizzleObject`, and adds
an ID and a root node lookup. The publishing User uses its integer primary key:

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});
```

This minimal alternative shows the node options. The publishing User adds full name, profile,
and published posts to the same type. Other ID field options can be passed alongside `column`;
for a composite primary key, `column` can return a list of columns.

### Refetch a public author

The publishing schema defines User as a Relay node. Its returned ID can be passed back to
`node` to fetch the author with a new selection:

```graphql
query RefetchAuthor {
  node(id: "VXNlcjox") {
    ... on User { fullName posts { title } }
  }
}
```

The operation uses the ID of User 1. The node returns the same public fields as the author lookup, including
only published posts. A node lookup does not route through a custom root resolver, so any
access restrictions on an entity must also hold when it is loaded as a node.

Post is an ordinary object in this schema. It is reachable through the published feed or the
current author's private drafts, and is not registered as a globally refetchable node.

The [public author definition](https://pothos-graphql.dev/docs/plugins/drizzle/relations#published-posts-and-profiles) applies its publication
filter on the relation itself, so it also holds when User is reached through `node`.

## Type variants

### Variants

A variant gives another GraphQL representation to the same database row. The publishing API
uses public User fields for author pages and a private Viewer for the signed-in account.

The API has three parts:

- `variant` registers an additional type instead of naming the primary type with `name`.
- `t.variant` returns another representation of the same row.
- A relation's `type` option can select a variant using its returned object ref.

### The author’s writing desk

The Viewer exposes email and drafts, and its `user` field returns the public representation.
It is an interface with editor and author implementations, described in [Interfaces](https://pothos-graphql.dev/docs/plugins/drizzle/interfaces):

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
  resolve: (query, _root, _args, ctx) =>
    db.query.users.findFirst(query({ where: { id: ctx.userId } })),
}),
```

Maya (`userId: 1`) sees “Planning the spring exchange”; Leo (`userId: 2`) sees “Saving rainwater.”
The interface and variants describe the shapes; the root lookup restricts ownership. Public
author fields and post connections return published posts only.

### A single object variant

When all viewers have the same fields, an object variant is sufficient. This alternative replaces
the Viewer interface and its implementations; the `me` field can still use its returned ref:

```ts
const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  select: {},
  fields: (t) => ({
    id: t.exposeID('id'),
    user: t.variant('users'),
    drafts: t.relation('posts', {
      query: { where: { published: false }, orderBy: { createdAt: 'desc', id: 'desc' } },
    }),
  }),
});
```

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

The field selects `id` for its ownership check. A variant field can also select other data,
planned alongside the variant's type selection. This alternative selects email:

```ts
builder.drizzleObjectField('users', 'viewer', (t) =>
  t.variant(Viewer, {
    select: { columns: { id: true, email: true } },
    isNull: (user, _args, ctx) => user.id !== ctx.userId,
  }),
);
```

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
    query: { where: { published: true }, orderBy: { id: 'asc' } },
  }),
);
```

Two variants selected for the same row have their type-level selections merged. Conflicting
relation arguments or extras can fail; see
[Conflicting selections between variants](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning#conflicting-selections-between-variants).

## Interfaces

### Interfaces

The publishing API returns a Viewer for the signed-in account. Editors and authors share email,
drafts, and a public User representation; editor accounts also expose a review capability.

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
  publishedPosts: t.relatedConnection('posts', { query: { where: { published: true } } }),
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
    newest: posts { title }
    oldest: posts(oldestFirst: true) { title }
  }
}
```

The [published-posts field](https://pothos-graphql.dev/docs/plugins/drizzle/relations#published-posts-and-profiles) translates those arguments
into different database orderings. Both results must retain their own order: “A guide to
composting” comes first in `newest`, and “Starting a seed library” comes first in `oldest`.
They cannot reuse the same loaded relation. The additional ordering is loaded through a fallback
query. The two ordered results establish the response behavior; the emitted SQL shows how each
relation selection was loaded.

For Drizzle, the author query with one ordering executes one SQL statement. Selecting both
orderings executes two. This is different from counting GraphQL resolver calls.

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
      select: (args, ctx, nestedSelection) => ({
        // what the query selects on the posts, limited to one
        with: { posts: nestedSelection({ where: { published: true }, orderBy: { id: 'asc' }, limit: 1 }) },
      }),
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

Use `t.relatedConnection` for the publishing API's ordinary [media relation](https://pothos-graphql.dev/docs/plugins/drizzle/relations#shared-media).
`drizzleConnectionHelpers` is for connections whose pagination row differs from their GraphQL node,
or whose query cannot be expressed as a normal relation.

The alternatives below use a separate membership model: User has `userRoles`; each UserRole has
`userId`, `roleId`, `accepted`, and `createdAt`, and a `role` relation to Role (`id`, `name`).
Define those tables and Drizzle relations before these snippets, and use the [Relay builder](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins).
Import `drizzleConnectionHelpers` from `@pothos/plugin-drizzle`. Each alternative replaces the
preceding helper or field of the same name.

### Indirect relations as connections

In many cases, you can define many to many connections via drizzle relations, allowing the `relatedConnection` API to work across
more complex relations. In some cases you may want to define a connection for a relation not expressed directly as a relation in
your drizzle schema.  For these cases, you can use the `drizzleConnectionHelpers`, which allows you to define connection with the `t.connection` API.

```typescript
// Create a drizzle object for the node type of your connection
const Role = builder.drizzleObject('roles', {
  name: 'Role',
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});



// Create connection helpers for the userRoles join table.  This will allow you
// to use the normal t.connection with a drizzle type
const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  // select the data needed for the nodes
  select: (nestedSelection) => ({
    with: {
      // use nestedSelection to create the correct selection for the node
      role: nestedSelection(),
    },
  }),
  // resolve the node from the returned list item
  resolveNode: (userRole) => userRole.role,
});

builder.drizzleObjectField('users', 'rolesConnection', (t) =>
  t.connection({
    // The type for the Node
    type: Role,
    nodeNullable: true,
    // since we are not using t.relatedConnection we need to manually
    // include the selections for our connection
    select: (args, ctx, nestedSelection) => ({
      with: {
        userRoles: rolesConnection.getQuery(args, ctx, nestedSelection),
      },
    }),
    // This helper takes a list of nodes and formats them for the connection
    resolve: (user, args, ctx) => {
      return rolesConnection.resolve(user.userRoles, args, ctx, user);
    },
  }),
);
```

The above example assumes that you are paginating a relation to a join table, where the pagination
args are applied based on the relation to that join table, but the nodes themselves are nested
deeper.

`drizzleConnectionHelpers` can also be used to manually create a connection where the edge and
connections share the same model, and pagination happens directly on a relation to nodes type (even
if that relation is nested).

This alternative assumes Post has a `comments` relation and a registered Comment type.
It paginates Comment rows directly, instead of membership join rows.

```ts
const commentConnectionHelpers = drizzleConnectionHelpers(builder, 'comments');

const SelectPost = builder.drizzleObject('posts', {
  fields: (t) => ({
    title: t.exposeString('title'),
    comments: t.connection({
      type: commentConnectionHelpers.ref,
      select: (args, ctx, nestedSelection) => ({
        with: {
          comments: commentConnectionHelpers.getQuery(args, ctx, nestedSelection),
        },
      }),
      resolve: (parent, args, ctx) => commentConnectionHelpers.resolve(parent.comments, args, ctx),
    }),
  }),
});
```

Replace the preceding `rolesConnection` helper and field to add filtering and ordering:

```ts
const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  // define additional arguments
  args: (t) => ({}),
  query: (args) => ({
    // define an order
    orderBy: {
      roleId: 'asc',
    },
    // define a filter
    where: {
      accepted: true,
    }
  }),
  // select the data needed for the nodes
  select: (nestedSelection) => ({
    with: {
      // use nestedSelection to create the correct selection for the node
      role: nestedSelection(),
    },
  }),
  // resolve the node from the returned list item
  resolveNode: (userRole) => userRole.role,
});


builder.drizzleObjectField('users', 'rolesConnection', (t) =>
  t.connection({
    type: Role,
    nodeNullable: true,
    // add the args from the connection helper to the field
    args: rolesConnection.getArgs(),
    select: (args, ctx, nestedSelection) => ({
      with: {
        userRoles: rolesConnection.getQuery(args, ctx, nestedSelection),
      },
    }),
    resolve: (user, args, ctx) => rolesConnection.resolve(user.userRoles, args, ctx, user),
  }),
);
```

### Extending connection edges

This alternative exposes the join row’s `createdAt` on each edge. It assumes a registered
`DateTime` scalar whose output type is `Date`.

```typescript
const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  select: (nestedSelection) => ({
    with: {
      role: nestedSelection(),
    },
  }),
  resolveNode: (userRole) => userRole.role,
});

builder.drizzleObjectFields('users', (t) => ({
  rolesConnection: t.connection(
    {
      type: Role,
      nodeNullable: true,
      select: (args, ctx, nestedSelection) => ({
        with: {
          userRoles: rolesConnection.getQuery(args, ctx, nestedSelection),
        },
      }),
      resolve: (user, args, ctx) =>
        rolesConnection.resolve(
          user.userRoles,
          args,
          ctx,
          user,
        ),
    },
    {},
    // options for the edge object
    {
      // define the additional fields on the edge object
      fields: (edge) => ({
        createdAt: edge.field({
          type: 'DateTime',
          // the parent shape for edge fields is inferred from the connections resolve function
          resolve: (role) => role.createdAt,
        }),
      }),
    },
  ),
}));
```

### Non-relation connections

You can also use `drizzleConnectionHelpers` for non-relation connections where you want a connection where your edges and nodes are not the same type.

Note that when doing this, you need to be careful to properly merge the `where` clause generated by the connection helper with any additional `where` clause you need to apply to your query

```typescript
const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  select: (nestedSelection) => ({
    with: {
      role: nestedSelection(),
    },
  }),
  resolveNode: (userRole) => userRole.role,
});

builder.queryFields((t) => ({
  roles: t.connection({
    type: Role,
    nodeNullable: true,
    args: {
      userId: t.arg.int({ required: true }),
    },
    resolve: async (_, args, ctx, info) => {
      const query = rolesConnection.getQuery(args, ctx, info);
      const userRoles = await db.query.userRoles.findMany({
        ...query,
        where: {
          AND: [query.where ?? {}, { userId: args.userId }],
        },
      });
      return rolesConnection.resolve(userRoles, args, ctx);
    },
  }),
}));
```

## Async selections

The publishing API’s selections are synchronous. An application may instead need to await a
request policy or another service before choosing a filter or page size. This is an alternative
builder configuration, using the tables and client from [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup).

### Async selections

Selections are synchronous unless the schema opts in with `AsyncSelections: true`. This example
uses request context methods that asynchronously return a user ID and a preview limit:

```ts
const builder = new SchemaBuilder<{
  DrizzleRelations: typeof relations;
  AsyncSelections: true;
  Context: {
    currentUserId: () => Promise<number>;
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

The plugin still builds a single query. It waits for the callbacks, and merges what they return
after every synchronous selection, in document order. `t.relation`, `t.relatedCount`,
`t.drizzleField`, `t.drizzleConnection` and `t.relatedConnection` settle their plan before the
resolver runs, and need no changes.

```ts
builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    posts: t.relation('posts', {
      query: async (args, ctx) => ({ where: { authorId: await ctx.currentUserId() } }),
    }),
    previewPosts: t.field({
      type: ['posts'],
      select: async (args, ctx, nestedSelection) => ({
        with: { posts: await nestedSelection({ where: { published: true }, orderBy: { id: 'asc' }, limit: await ctx.previewSize() }) },
      }),
      resolve: (user) => user.posts,
    }),
  }),
});
```

`await` what `nestedSelection` returns before putting it in the selection, and the same for the
`nestedQuery` passed as the fourth argument of a `t.relatedField` `select`. A selection that
contains the promise itself will throw, and so will a `select` that returns while a nested
selection it started is still pending. Calling `nestedSelection` and discarding a synchronous
result is not detected, and the nested selection will not be loaded with the parent.

Pass `awaitSelections: true` to `drizzleConnectionHelpers(...).getQuery`, and `await` the query it
returns. Without it, an async selection beneath the field throws, and whether there is one
depends on the incoming document rather than on the callback you wrote. A connection helper also
throws when its own `select` or `query` is async, whatever the document asked for:

```ts
select: async (args, ctx, nestedSelection) => ({
  with: {
    comments: await commentConnectionHelpers.getQuery(args, ctx, nestedSelection, {
      awaitSelections: true,
    }),
  },
}),
```

`awaitSelections` is a per-call option, and is available whether or not the schema sets
`AsyncSelections`.

When `AsyncSelections: true`, also `await` a connection helper's `resolve()` before inspecting or
spreading its result: an async `query` callback makes resolution asynchronous. Returning its
result directly from a GraphQL resolver remains supported.


The connection-helper excerpt assumes a registered comments relation and
`commentConnectionHelpers` from [Connection helpers](https://pothos-graphql.dev/docs/plugins/drizzle/connection-helpers). Request-context
methods must be supplied by the application; they are not created by declaring the Context type.
