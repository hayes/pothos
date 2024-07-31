# Drizzle Plugin

## Installing

```package-install
npm install --save @pothos/plugin-drizzle
```

The drizzle plugin is built on top of drizzles relational query builder, and requires that you
define and configure all the relevant relations in your drizzle schema. See
https://orm.drizzle.team/docs/rqb for detailed documentation on the relations API.

In addition to defining relations, the Pothos drizzle plugin also requires defining a `primaryKey`
for every table used as a `drizzleObject`, `drizzleNode`, or `drizzleInterface`.

Once you have configured you have configured you drizzle schema, you can initialize your Pothos
SchemaBuilder with the drizzle plugin:

```ts
import * as schema from './schema';
import { drizzle } from 'drizzle-orm/...';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';

const db = drizzle(client, { schema });

export interface PothosTypes {
  DrizzleSchema: typeof schema;
}

const builder = new SchemaBuilder<PothosTypes>({
  plugins: [DrizzlePlugin],
  drizzle: {
    client: db,
  },
});
```

### Integration with other plugins

The drizzle plugin has integrations with several other plugins. While the `with-input` and `relay`
plugins are not required, many examples will assume these plugins have been installed:

```ts
import * as schema from './schema';
import { drizzle } from 'drizzle-orm/...';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import RelayPlugin from '@pothos/plugin-scope-auth';
import WithInputPlugin from '@pothos/plugin-with-input';

const db = drizzle(client, { schema });

export interface PothosTypes {
  DrizzleSchema: typeof schema;
}

const builder = new SchemaBuilder<PothosTypes>({
  plugins: [RelayPlugin, WithInputPlugin, DrizzlePlugin],
  drizzle: {
    client: db,
  },
});
```

## Defining Objects

The `builder.drizzleObject` method can be used to define GraphQL Object types based on a drizzle
table:

```ts
const UserRef = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('first_name'),
    lastName: t.exposeString('last_name'),
  }),
});
```

You will be able to "expose" any column in the table, and GraphQL fields do not need to match the
names of the columns in your database. The returned `UserRef` can be used like any other `ObjectRef`
in Pothos.

## Custom fields

You will often want to define fields in your API that do not correspond to a specific database
column. To do this, you can define fields with a resolver like any other Pothos object type:

```ts
const UserRef = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    fullName: t.string({
      resolve: (user, args, ctx, info) => `${user.first_name} ${user.last_name}`,
    }),
  }),
});
```

## Type selections

In the above example, you can see that by default we have access to all columns of our table. For
tables with many columns, it can be more efficient to only select the needed columns. You can
configure the selected columns, and relations by passing a `select` option when defining the type:

```ts
const UserRef = builder.drizzleObject('users', {
  name: 'User',
  select: {
    columns: {
      first_name: true,
      last_name: true,
    },
    with: {
      profile: true,
    },
    extras: {
      lowercaseName: sql<string>`lower(${users.firstName})`.as('lowercaseName'),
    },
  },
  fields: (t) => ({
    fullName: t.string({
      resolve: (user, args, ctx, info) => `${user.first_name} ${user.last_name}`,
    }),
    bio: t.string({
      resolve: (user) => user.profile.bio,
    }),
    email: t.string({
      resolve: (user) => `${user.lowercaseName}@example.com`,
    }),
  }),
});
```

Any selections added to the type will be available to consume in all resolvers. Columns that are not
selected can still be exposed as before.

## Field selections

The previous example allows you to control what gets selected by default, but you often want to only
select the columns that are required to fulfill a specific field. You can do this by adding the
appropriate selections on each field:

```ts
const UserRef = builder.drizzleObject('users', {
  name: 'User',
  select: {
    // By default all columns are selected, so this is required to default to an empty selection
    columns: {},
  },
  fields: (t) => ({
    fullName: t.string({
      select: {
        columns: { first_name: true, last_name: true },
      },
      resolve: (user, args, ctx, info) => `${user.first_name} ${user.last_name}`,
    }),
    bio: t.string({
      select: {
        // Currently, adding a selection without explicitly defining columns will cause all columns to be selected
        columns: {},
        with: { profile: true },
      },
      resolve: (user) => user.profile.bio,
    }),
    email: t.string({
      select: {
        columns: {},
        extras: {
          lowercaseName: sql<string>`lower(${users.firstName})`.as('lowercaseName'),
        },
      },
      resolve: (user) => `${user.lowercaseName}@example.com`,
    }),
  }),
});
```

## Relations

Drizzles relational query builder allows you to define the relationships between your tables. The
`builder.relation` method makes it easy to add fields to your GraphQL API that implement those
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
    firstName: t.exposeString('first_name'),
    profile: t.relation('profile'),
    posts: t.relation('posts'),
  }),
});
```

The relation will automatically define GraphQL fields of the appropriate type based on the relation
defined in your drizzle schema.

## Relation queries

For some cases, exposing relations as fields without any customization works great, but in some
cases you may want to apply some filtering or ordering to your relations. This can be done by
specifying a `query` option on the relation:

```ts
builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('first_name'),
    posts: t.relation('posts', {
      args: {
        limit: t.arg.int(),
        offset: t.arg.int(),
      },
      query: (args) => ({
        limit: args.limit ?? 10,
        offset: args.offset ?? 0,
        where: (post, { eq }) => eq(post.published, true),
        orderBy: (post, { desc }) => desc(post.updatedAt),
      }),
    }),
    drafts: t.relation('posts', {
      query: {
        where: (post, { eq }) => eq(post.published, false),
      },
    }),
  }),
});
```

The query API enables you to define args and convert them into parameters that will be passed into
the relational query builder. You can read more about the relation query builder api
[here](https://orm.drizzle.team/docs/rqb#querying)

## Drizzle Fields

Drizzle objects and relations allow you to define parts of your schema backed by your drizzle
schema, but don't provide a clear entry point into this Graph of data. To make your drizzle objects
queryable, we will need to add fields that return our drizzle objects. This can be done using the
`t.drizzleField` method. This can be used to define fields on the root `Query` type, or any other
object type in your schema:

```ts
builder.queryType({
  fields: (t) => ({
    post: t.drizzleField({
      type: 'posts',
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (query, root, args, ctx) =>
        db.query.posts.findFirst(
          query({
            where: eq(posts.id, Number.parseInt(args.id, 10)),
          }),
        ),
    }),
    posts: t.drizzleField({
      type: ['posts'],
      resolve: (query, root, args, ctx) => db.query.posts.findMany(query()),
    }),
  }),
});
```

The `resolve` function of a `drizzleField` will be passed a `query` function that MUST be called and
passed to a drizzle `findOne` or `findMany` query. The `query` function optionally accepts any
arguments that are normally passed into the query, and will merge these options with the selection
used to resolve data for the nested GraphQL selections.

## Variants

It is often useful to be able to define multiple object types based on the same table. This can be
done using a feature called `variants`. The `variants` API consists of 3 parts:

- A `variant` option that can be passed instead of a name on `drizzleObjects`
- The ability to pass an `ObjectRef` to the `type` option of `t.relation` and other similar fields
- A `t.field` method that works similar to `t.relation, but is used to define a GraphQL field that
  references a variant of the same record.

```ts
// Viewer type representing the current user
export const Viewer = builder.drizzleObject('users', {
  variant: 'Viewer',
  select: {
    columns: {},
  },
  fields: (t) => ({
    id: t.exposeID('id'),
    // A reference to the normal user type so normal user fields can be queried
    user: t.variant('users'),
    // Adding drafts to View allows a user to fetch their own drafts without exposing it for Other Users in the API
    drafts: t.relation('posts', {
      query: {
        where: (post, { eq }) => eq(post.published, false),
        orderBy: (post, ops) => ops.desc(post.updatedAt),
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
            where: (user, { eq }) => eq(user.id, ctx.user.id),
          }),
        ),
    }),
  }),
});

builder.drizzleNode('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // This field will resolve to the Viewer type, but be set to null if the user is not the current user
    viewer: t.variant(Viewer, {
      isNull: (user, args, ctx) => user.id !== ctx.user?.id,
    }),
  }),
});
```

## Relay integration

Relay provides some very useful best practices that are useful for most GraphQL APIs. To make it
easy to comply with these best practices, the drizzle plugin has built in support for defining relay
`nodes` and `connections`.

## Relay Nodes

Defining relay nodes works just like defining normal `drizzleObject`s, but requires specifying a
colum to use as the nodes `id` field.

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

## Related connections

To implement a relation as a connection, you can use `t.relatedConnection` instead of `t.relation`:

```ts
builder.drizzleNode('users', {
  name: 'User',
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
the `t.relatedConnection` method accepts orderBy as an object like `{ asc: column }` or
`{ desc: column }` rather than using the `asc(column)` and `desc(column)` helpers from drizzle.
orderBy can still be returned as either a single column or array when ordering by multiple columns.

Ordering defaults to using the table `primaryKey`, and the orderBy columns will also be used to
derive the connections cursor.

```ts
builder.drizzleNode('users', {
  name: 'User',
  fields: (t) => ({
    posts: t.relatedConnection('posts', {
      query: () => ({
        where: (post, { eq }) => eq(post.published, 1),
        orderBy: (post) => ({
          desc: post.id,
        }),
      }),
    }),
  }),
});
```

## Drizzle connections

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
          where: (post, { eq }) => eq(post.published, true),
          orderBy: (post) => ({ desc: post.id }),
        }),
      ),
  }),
}));
```
