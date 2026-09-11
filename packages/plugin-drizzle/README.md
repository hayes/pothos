# Drizzle Plugin for Pothos

> **Note:**
  This plugin uses drizzle's [relational query builder v2](https://orm.drizzle.team/docs/rqb-v2),
  which ships in `drizzle-orm` 1.0. That release is still a release candidate, and npm's `latest`
  tag is the 0.x line, so install drizzle with the `rc` tag. Its API can still change before 1.0 is
  final.

  If you are upgrading from an older version of this plugin, read drizzle's [relations v1 to v2
  guide](https://orm.drizzle.team/docs/relations-v1-v2), then this package's changelog for the
  Pothos specific changes.


The Drizzle plugin defines GraphQL types from your tables and plans database queries from GraphQL
selections. It loads relations and integrates with Relay nodes and connections.

## Getting started

Install the plugin and add it to your builder, as described in [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup):

```package-install
npm install --save @pothos/plugin-drizzle drizzle-orm@rc
```

Define an object type for a table, expose the columns you want in your API, and add the relations
you want clients to query. This example uses the builder, database client, and `userId` context
from Setup, with a users table related to posts:

```ts
const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
    posts: t.relation('posts'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({ title: t.exposeString('title') }),
});

builder.queryType({
  fields: (t) => ({
    me: t.drizzleField({
      type: 'users',
      nullable: true,
      resolve: (query, root, args, ctx) =>
        db.query.users.findFirst(query({ where: { id: ctx.userId } })),
    }),
  }),
});
```

Querying `me { firstName posts { title } }` loads the user and their posts in a single query
through drizzles relational query builder.

## Setup

### Installing

```package-install
npm install --save @pothos/plugin-drizzle drizzle-orm@rc
```

The Drizzle plugin uses the relational query builder. Define the tables and relations your schema
will query; see Drizzle’s [relations API](https://orm.drizzle.team/docs/relations-v2).

Once you have configured your drizzle schema, you can initialize your Pothos
SchemaBuilder with the drizzle plugin. This example uses SQLite through `@libsql/client`;
install that driver and use the `relations` exported by your application. For another database,
use its Drizzle driver and matching `getTableConfig` import:

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
// Import the appropriate getTableConfig for your dialect
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import { relations } from './db/relations';

const client = createClient({ url: 'file:./dev.db' });
const db = drizzle({ client, relations });

type DrizzleRelations = typeof relations;

export interface PothosTypes {
  DrizzleRelations: DrizzleRelations;
  Context: { userId: number };
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

The examples use an authenticated request context with `userId: number`. Supply it through your
GraphQL server; see [Context](https://pothos-graphql.dev/docs/guide/context).

#### Integration with other plugins

The drizzle plugin has integrations with several other plugins. While the `with-input` and `relay`
plugins are not required, many examples will assume these plugins have been installed:

```ts
import { createClient } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { relations } from './db/relations';

const client = createClient({ url: 'file:./dev.db' });
const db = drizzle({ client, relations });

export interface PothosTypes {
  DrizzleRelations: typeof relations;
  Context: { userId: number };
}

const builder = new SchemaBuilder<PothosTypes>({
  plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: {
    client: db,
    getTableConfig,
    relations,
  },
});
```

#### Plugin options

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

### Tables for a publishing API

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

## Drizzle Objects

Use the builder and database client from [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup). The examples below use a `users` table
with an integer `id` and string `firstName` and `lastName` columns.

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

### Custom fields

You will often want to define fields in your API that do not correspond to a specific database
column. For example, replace the object definition above with a computed full name:

```ts
const User = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    fullName: t.string({
      resolve: (user, args, ctx, info) => `${user.firstName} ${user.lastName}`,
    }),
  }),
});
```

### Drizzle Fields

Drizzle objects and relations allow you to define parts of your schema backed by your drizzle
schema, but don't provide a clear entry point into this Graph of data. To make your drizzle objects
queryable, we will need to add fields that return our drizzle objects. This can be done using the
`t.drizzleField` method. This can be used to define fields on the root `Query` type, or any other
object type in your schema:

```ts
builder.queryType({
  fields: (t) => ({
    user: t.drizzleField({
      type: 'users',
      nullable: true,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, args, ctx) =>
        db.query.users.findFirst(
          query({
            where: {
              id: Number.parseInt(args.id, 10),
            },
          }),
        ),
    }),
    users: t.drizzleField({
      type: ['users'],
      resolve: (query, root, args, ctx) => db.query.users.findMany(query()),
    }),
  }),
});
```

The `resolve` function of a `drizzleField` receives a `query` function. Call it and pass its result
to a Drizzle `findFirst` or `findMany` query. The `query` function optionally accepts any
arguments that are normally passed into the query, and will merge these options with the selection
used to resolve data for the nested GraphQL selections.

#### `drizzleFieldWithInput`

With the [with-input plugin](https://pothos-graphql.dev/docs/plugins/with-input),
`t.drizzleFieldWithInput` combines `t.drizzleField` with `t.fieldWithInput`. The `input` fields
become an input object argument, and the resolver still receives the `query` function as its first
argument. This replaces the `user` field above:

```ts
builder.queryFields((t) => ({
  user: t.drizzleFieldWithInput({
    type: 'users',
    nullable: true,
    input: {
      id: t.input.id({ required: true }),
    },
    resolve: (query, root, args, ctx) =>
      db.query.users.findFirst(query({ where: { id: Number.parseInt(args.input.id, 10) } })),
  }),
}));
```

### A nullable author lookup

An author page can use a nullable `t.drizzleField` so an unknown ID returns null. Pass the
selection function's result to `findFirst`; nested fields then contribute their requirements to
that query. This field uses the public User type from the [publishing schema](https://pothos-graphql.dev/docs/plugins/drizzle/relations#published-posts-and-profiles):

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

## Relations

### Relations

Drizzles relational query builder allows you to define the relationships between your tables. The
`t.relation` method makes it easy to add fields to your GraphQL API that implement those
relations:

```ts
builder.drizzleObject('profiles', {
  name: 'Profile',
  fields: (t) => ({
    bio: t.exposeString('bio'),
  }),
});

builder.drizzleObject('posts', {
  name: 'Post',
  fields: (t) => ({
    title: t.exposeString('title'),
    author: t.relation('author'),
  }),
});

builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    profile: t.relation('profile'),
    posts: t.relation('posts'),
  }),
});
```

The relation will automatically define GraphQL fields of the appropriate type based on the relation
defined in your drizzle schema.

### Relation queries

For some cases, exposing relations as fields without any customization works great, but in some
cases you may want to apply some filtering or ordering to your relations. This can be done by
specifying a `query` option on the relation:

```ts
builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
      },
      // query callback receives (args, ctx, pathInfo)
      query: (args) => ({
        limit: args.limit ?? 10,
        offset: args.offset ?? 0,
        where: {
          published: true,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      }),
    }),
    drafts: t.relation('posts', {
      query: {
        where: {
          published: false,
        },
      },
    }),
  }),
});
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

### Related field

The `t.relatedField` method allows you to define a field based on a relation that uses custom
selections, including aggregations like counts. This is useful when you want to expose derived data
from a relation without loading the full related records.

#### Count aggregations

One common use case is adding a count field that efficiently counts related records:

```ts
import { count } from 'drizzle-orm';

builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // Add a count of related posts
    postsCount: t.relatedField('posts', {
      type: 'Int',
      // buildFilter creates the correct WHERE clause for the relation
      select: (buildFilter) => ({
        extras: {
          postsCount: (parent) => db.$count(posts, buildFilter(parent)),
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

### Related count

For the common case of counting related records, there's a simpler `t.relatedCount` method that handles
all the boilerplate for you:

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // Simple count of all related comments
    commentsCount: t.relatedCount('comments'),
    // Count with a where filter
    publishedPostsCount: t.relatedCount('posts', {
      where: eq(posts.published, true),
    }),
  }),
});
```

The `where` option accepts either a static SQL filter or a function that receives the field arguments
and context:

```ts
publishedPostsCount: t.relatedCount('posts', {
  args: {
    category: t.arg.string(),
  },
  where: (args, ctx) => args.category
    ? and(eq(posts.published, true), eq(posts.category, args.category))
    : eq(posts.published, true),
});
```

For a many-to-many relation (one defined with `.through(...)`), `t.relatedCount` counts distinct
related rows, so a row reachable through two junction rows counts once. A `t.relatedConnection`'s
`totalCount` counts the rows the connection pages over instead, which is one per junction row,
since that is what the relational query builder returns for the relation.

### Published posts and profiles

In a publishing API, a public author page exposes published posts and an optional profile.
Drafts belong on the [private viewer](https://pothos-graphql.dev/docs/plugins/drizzle/variants#the-authors-writing-desk). Filtering the list and
its count consistently prevents the count from revealing unpublished posts. Sorting by both the
timestamp and ID makes the order deterministic when two posts share a timestamp.

The following type is used by the nullable `author` lookup in [Objects](https://pothos-graphql.dev/docs/plugins/drizzle/objects#a-nullable-author-lookup):

```typescript
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  select: {},
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    fullName: t.string({
      select: { columns: { firstName: true, lastName: true } },
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    bio: t.string({
      nullable: true,
      select: { with: { profile: true } },
      resolve: (user) => user.profile?.bio,
    }),
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
    postCount: t.relatedCount('posts', { where: eq(posts.published, true) }),
    postsConnection: t.relatedConnection('posts', {
      query: { where: { published: true }, orderBy: { createdAt: 'desc' } },
      totalCount: true,
    }),
  }),
});
```

`author(id: 1) { fullName bio postCount posts { title } }` returns Maya's profile and two
published posts. Nora (`id: 3`) has no profile or posts, so `bio` is null, `posts` is empty, and
`postCount` is zero. A missing relation is represented as missing data, without manufacturing a
profile record.

#### Shared media

A post can expose its attached media directly even though the database stores attachments in a
join table. The `media` relation in [Setup](https://pothos-graphql.dev/docs/plugins/drizzle/setup#publishing-tables) uses `through` to connect those
tables. Both the list and connection use that relation, so their selections also load the uploader:

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

“Starting a seed library” and “A guide to composting” share one image uploaded by Leo.
The attachment uniqueness constraint prevents the same image being attached to a post twice;
the connection's count measures related media rather than an unrelated global table count.

## Selections

### Type selections

By default, a `drizzleObject` gives its resolvers access to all columns of the table. For tables
with many columns, it can be more efficient to only select the needed columns. You can configure the
selected columns, and relations by passing a `select` option when defining the type:

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

### Field selections

The previous example allows you to control what gets selected by default, but you often want to only
select the columns that are required to fulfill a specific field. You can do this by adding the
appropriate selections on each field. Replace the preceding User definition with:

```ts
const User = builder.drizzleObject('users', {
  name: 'User',
  select: {},
  fields: (t) => ({
    fullName: t.string({
      select: {
        columns: { firstName: true, lastName: true },
      },
      resolve: (user, args, ctx, info) => `${user.firstName} ${user.lastName}`,
    }),
    bio: t.string({
      nullable: true,
      select: {
        with: { profile: true },
      },
      resolve: (user) => user.profile?.bio,
    }),
    lowercaseName: t.string({
      select: {
        extras: {
          lowercaseName: (users, { sql }) => sql<string>`lower(${users.firstName})`
        },
      },
      resolve: (user) => user.lowercaseName,
    }),
  }),
});
```

### Only load a profile when requested

The [public author type](https://pothos-graphql.dev/docs/plugins/drizzle/relations#published-posts-and-profiles) keeps its default selection
small. Its `bio` field declares the profile relation it needs, so a query for the author's name
alone does not load a profile. Adding `bio` adds that relation to the database query; the resolver
then reads the selected row. A nullable profile still produces a nullable biography.

This distinction matters for computed fields: a resolver accessing related data must declare that
data in its selection, even when the GraphQL field itself is just a string.

## Connections

Use the [builder setup with Relay](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins) and register the users
and posts object types. Examples defining the same field or helper are alternatives.

### Related connections

To implement a relation as a connection, you can use `t.relatedConnection` instead of `t.relation`:

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    posts: t.relatedConnection('posts'),
  }),
});
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

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      query: () => ({
        where: {
          published: true,
        },
        orderBy: {
          id: 'desc',
        },
      }),
    }),
  }),
});
```

#### Connection totalCount

You can add a `totalCount` field to your connection by setting the `totalCount` option to `true`:

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      totalCount: true,
      query: () => ({
        where: {
          published: true,
        },
        orderBy: {
          id: 'desc',
        },
      }),
    }),
  }),
});
```

This will automatically add a `totalCount` field to the connection type. The count query is only
executed when the `totalCount` field is actually requested in the GraphQL query, and it's included
as a subquery in the main database query for efficiency.

```graphql
query {
  user(id: "...") {
    posts(first: 10) {
      totalCount
      edges {
        node {
          id
          title
        }
      }
    }
  }
}
```

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

### Drizzle connections

Similar to `t.drizzleField`, `t.drizzleConnection` allows you to define a connection field that acts
as an entry point to your drizzle query. The `orderBy` in `t.drizzleConnection` works the same way
as it does for `t.relatedConnection`

```ts
builder.queryFields((t) => ({
  posts: t.drizzleConnection({
    type: 'posts',
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

#### drizzleConnection totalCount

You can add a `totalCount` field to a `drizzleConnection` by providing a `totalCount` callback function that returns the count:

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

#### Indirect relations as connections

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

#### Extending connection edges

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

#### `drizzleConnectionHelpers` for non-relation connections

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

### Page through published posts

These queries use `nodes` on connections. Enable `relay: { nodesOnConnection: true }` in the
builder options, or select `edges { node { title } }` with the default Relay configuration.

A public post connection applies the same `published` filter as author pages. The publishing
schema uses this root connection alongside its private viewer:

```typescript
builder.queryFields((t) => ({
  me: t.drizzleField({
    type: Viewer,
    nullable: true,
    resolve: (query, _root, _args, ctx) =>
      db.query.users.findFirst(query({ where: { id: ctx.userId } })),
  }),
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
}));
```

```graphql
query PublishedPosts {
  posts(first: 2) {
    nodes { title }
    pageInfo { endCursor hasNextPage }
  }
}
```

There are three published posts and two drafts in this dataset. The first page contains two
published posts and has a next page. Passing its `endCursor` as `after` returns the remaining
published post. The related author connection uses the same filter for its nodes and `totalCount`,
so Maya's count is two, including when the client requests only the count.

## Ordering and cursors

### Ordering and cursors

Connections page with a cursor that records where in the ordering the previous page ended. This
applies to `t.relatedConnection`, `t.drizzleConnection`, and `drizzleConnectionHelpers`.

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

### Tied timestamps in a feed

All three published posts in the [publishing schema](https://pothos-graphql.dev/docs/plugins/drizzle/connections#page-through-published-posts)
share one timestamp. Its connection orders by `createdAt: 'desc'`, so Pothos appends the primary
key in descending order. The first page returns “Watering through summer” and “A guide to
composting”; continuing from its end cursor returns “Starting a seed library” exactly once.

This example uses fixed-width UTC text with millisecond precision. It demonstrates ordering ties
without introducing a driver precision conversion; the Postgres precision guidance above still
applies when using timestamp columns.

## Relay

### Relay integration

Relay provides some very useful best practices that are useful for most GraphQL APIs. To make it
easy to comply with these best practices, the drizzle plugin has built in support for defining relay
`nodes` and `connections`.

### Relay Nodes

Defining relay nodes works just like defining normal `drizzleObject`s, but requires specifying a
column to use as the node's `id` field.

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: {
    column: (user) => user.id,
    // other options for the ID field can be passed here
  },
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
  }),
});
```

The id column can also be set to a list of columns for types with a composite primary key.

### Refetch a public author

The schema defines User as a Relay node. Its returned ID can be passed back to
`node` to fetch the author with a new selection:

```graphql
query RefetchAuthor {
  node(id: "VXNlcjox") {
    ... on User { fullName posts { title } }
  }
}
```

The ID identifies User 1. The node returns the same public fields as the author lookup, including
only published posts. A node lookup does not route through a custom root resolver, so any
access restrictions on an entity must also hold when it is loaded as a node.

Post is an ordinary object in this schema. It is reachable through the published feed or the
current author's private drafts, and is not registered as a globally refetchable node.

## Type variants

Use the [builder setup with Relay](https://pothos-graphql.dev/docs/plugins/drizzle/setup#integration-with-other-plugins), and include
`Context: { user: { id: number } }` in `PothosTypes`. These examples assume an authenticated user
and a registered posts type. The `users` table has a posts relation.

### Variants

It is often useful to be able to define multiple object types based on the same table. This can be
done using a feature called `variants`. The `variants` API consists of 3 parts:

- A `variant` option that can be passed instead of a name on `drizzleObjects`
- The ability to pass an `ObjectRef` to the `type` option of `t.relation` and other similar fields
- A `t.variant` method that works similar to `t.relation`, but is used to define a GraphQL field that
  references a variant of the same record.

```ts
// Viewer type representing the current user
export const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  select: {},
  fields: (t) => ({
    id: t.exposeID('id'),
    // A reference to the normal user type so normal user fields can be queried
    user: t.variant('users'),
    // Adding drafts to View allows a user to fetch their own drafts without exposing it for Other Users in the API
    drafts: t.relation('posts', {
      query: {
        where: {
          published: false,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      },
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    me: t.drizzleField({
      // We can use the ref returned by builder.drizzleObject to define our `drizzleField`
      type: Viewer,
      resolve: (query, root, args, ctx) =>
        db.query.users.findFirst(
          query({
            where: {
              id: ctx.user.id,
            },
          }),
        ),
    }),
  }),
});

builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // This field will resolve to the Viewer type, but be set to null if the user is not the current user
    viewer: t.variant(Viewer, {
      isNull: (user, args, ctx) => user.id !== ctx.user?.id,
    }),
  }),
});
```

As an alternative to the User node definition above, a `t.variant` field can have a `select` of its own. It is planned along with the variant's
type-level selection when the variant is queried through that field:

```ts
builder.drizzleNode('users', {
  name: 'User',
  id: { column: (user) => user.id },
  fields: (t) => ({
    viewer: t.variant(Viewer, {
      // loaded with the row when `viewer` is selected
      select: { columns: { email: true } },
      isNull: (user, args, ctx) => user.id !== ctx.user?.id,
    }),
  }),
});
```

Two variants of one table selected for the same row have their type-level selections merged into a
single query, which can fail if they disagree. See
[Conflicting selections between variants](https://pothos-graphql.dev/docs/plugins/drizzle/query-planning#conflicting-selections-between-variants).

### The author’s writing desk

A public User and a private Viewer can represent the same row. The Viewer exposes the current
author's email and drafts, and its `user` field returns the public representation. The root `me`
resolver uses the authenticated context ID; it does not accept an arbitrary author's ID.

This version makes Viewer an interface so editor and author accounts can expose different fields:

```typescript
const Viewer = builder.drizzleInterface('users', {
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

With Maya's context (`userId: 1`), `me` is an EditorViewer with the draft “Planning the spring
exchange.” With Leo's context (`userId: 2`), it is an AuthorViewer with “Saving rainwater.”
The interface describes the result shape; the root lookup supplies the ownership restriction.
Neither public author fields nor public post connections return those drafts.

## Interfaces

### Interfaces

`builder.drizzleInterface` works just like `builder.drizzleObject`, and can be used to define
either the primary type or a variant of a table as an interface that other variants implement. The
interface's `select` is planned whenever a field returns the interface, and an implementation's own
`select` is planned when a fragment narrows to it. Selections are not inherited, so an
implementation that exposes more columns will need a `select` of its own.

```ts
export const Viewer = builder.drizzleInterface('users', {
  variant: 'Viewer',
  select: { columns: { id: true, role: true } },
  resolveType: (user) => (user.role === 'admin' ? 'AdminViewer' : 'MemberViewer'),
  fields: (t) => ({
    id: t.exposeID('id'),
    user: t.variant('users'),
  }),
});

builder.drizzleObject('users', {
  variant: 'AdminViewer',
  interfaces: [Viewer],
  select: { columns: { permissions: true } },
  fields: (t) => ({
    permissions: t.exposeStringList('permissions'),
  }),
});

builder.drizzleObject('users', {
  variant: 'MemberViewer',
  interfaces: [Viewer],
  select: { columns: { id: true } },
});
```

Fields can be added to an interface later with `builder.drizzleInterfaceField` and
`builder.drizzleInterfaceFields`, which take the interface ref (or the table name) like their
`drizzleObjectField(s)` counterparts:

```ts
builder.drizzleInterfaceFields(Viewer, (t) => ({
  posts: t.relatedConnection('posts'),
}));
```

An object type implementing a drizzle interface must be based on the same table. A plain object
type that implements one is planned with the interface's table, so fragments on it will select the
relations it inherits.

### Selecting a viewer implementation

The [writing desk](https://pothos-graphql.dev/docs/plugins/drizzle/variants#the-authors-writing-desk) uses a Viewer interface for the signed-in
author and two object variants for account capabilities. Its type-level selection includes the
discriminator (`role`) used by `resolveType`. Each implementation also selects the fields
required by that interface; configuring a selection on the interface does not replace the
implementation's selection.

```graphql
query WritingDesk {
  me {
    __typename
    drafts { title }
    ... on EditorViewer { canReviewSubmissions }
  }
}
```

The editor result includes `canReviewSubmissions: true`. An author result has no field from that
fragment, while retaining the interface's `drafts` field. This keeps the public User type separate
from account-specific capabilities.

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
      type: [Post],
      select: (args, ctx, nestedSelection) => ({
        // what the query selects on the posts, limited to one
        with: { posts: nestedSelection({ limit: 1 }) },
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
      type: [Post],
      select: async (args, ctx, nestedSelection) => ({
        with: { posts: await nestedSelection({ limit: await ctx.previewSize() }) },
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
query. Compare both results and the emitted SQL; a response alone does not establish how the relation was loaded.

For Drizzle, the author query with one ordering executes one SQL statement. Selecting both
orderings executes two. This is different from counting GraphQL resolver calls.
