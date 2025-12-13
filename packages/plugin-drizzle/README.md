# Drizzle Plugin

## Installing

```package-install
npm install --save @pothos/plugin-drizzle drizzle-orm@beta
```

The drizzle plugin is built on top of drizzles relational query builder, and requires that you
define and configure all the relevant relations in your drizzle schema. See
https://rqbv2.drizzle-orm-fe.pages.dev/docs/relations-v2 for detailed documentation on the relations API.

Once you have configured your drizzle schema, you can initialize your Pothos
SchemaBuilder with the drizzle plugin:

```ts
import { drizzle } from 'drizzle-orm/...';
// Import the appropriate getTableConfig for your dialect
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import { relations } from './db/relations';

const db = drizzle({ client, relations });

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

### Integration with other plugins

The drizzle plugin has integrations with several other plugins. While the `with-input` and `relay`
plugins are not required, many examples will assume these plugins have been installed:

```ts
import { drizzle } from 'drizzle-orm/...';
import SchemaBuilder from '@pothos/core';
import DrizzlePlugin from '@pothos/plugin-drizzle';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { getTableConfig } from 'drizzle-orm/sqlite-core';
import { relations } from './db/relations';

const db = drizzle({ client, relations });

export interface PothosTypes {
  DrizzleRelations: typeof relations;
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

## Defining Objects

The `builder.drizzleObject` method can be used to define GraphQL Object types based on a drizzle
table:

```ts
const UserRef = builder.drizzleObject('users', {
  name: 'User',
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    lastName: t.exposeString('lastName'),
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
      resolve: (user, args, ctx, info) => `${user.firstName} ${user.lastName}`,
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
      firstName: true,
      lastName: true,
    },
    with: {
      profile: true,
    },
    extras: {
      lowercaseName: (users, sql) => sql<string>`lower(${users.firstName})`
    },
  },
  fields: (t) => ({
    fullName: t.string({
      resolve: (user, args, ctx, info) => `${user.firstName} ${user.lastName}`,
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
  select: {},
  fields: (t) => ({
    fullName: t.string({
      select: {
        columns: { firstName: true, lastName: true },
      },
      resolve: (user, args, ctx, info) => `${user.firstName} ${user.lastName}`,
    }),
    bio: t.string({
      select: {
        with: { profile: true },
      },
      resolve: (user) => user.profile.bio,
    }),
    email: t.string({
      select: {
        extras: {
          lowercaseName: (users, sql) => sql<string>`lower(${users.firstName})`
        },
      },
      resolve: (user) => `${user.lowercaseName}@example.com`,
    }),
  }),
});
```

## Relations

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

## Relation queries

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
            where: {
              id: Number.parseInt(args.id, 10),
            },
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
  fields: (t) => ({
    firstName: t.exposeString('firstName'),
    // This field will resolve to the Viewer type, but be set to null if the user is not the current user
    viewer: t.variant(Viewer, {
      isNull: (user, args, ctx) => user.id !== ctx.user?.id,
    }),
  }),
});
```


## Related field

The `t.relatedField` method allows you to define a field based on a relation that uses custom
selections, including aggregations like counts. This is useful when you want to expose derived data
from a relation without loading the full related records.

### Count aggregations

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

## Related count

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
}),
```

## Relay integration

Relay provides some very useful best practices that are useful for most GraphQL APIs. To make it
easy to comply with these best practices, the drizzle plugin has built in support for defining relay
`nodes` and `connections`.

## Relay Nodes

Defining relay nodes works just like defining normal `drizzleObject`s, but requires specifying a
column to use as the nodes `id` field.

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

### Connection totalCount

You can add a `totalCount` field to your connection by setting the `totalCount` option to `true`:

```ts
builder.drizzleNode('users', {
  name: 'User',
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

### drizzleConnection totalCount

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



// Create connection helpers for the media type.  This will allow you
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

builder.drizzleObjectField('User', 'rolesConnection', (t) =>
  t.connection({
    // The type for the Node
    type: Role,
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
const commentConnectionHelpers = drizzleConnectionHelpers(builder, 'Comment');

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

Arguments, ordering and filtering can also be defined in the helpers:

```ts
const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  // define additional arguments
  args: (t) => ({}),
  query: (args) => ({
    // define an order
    orderBy: {
      roleId: 'asc',
    }
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


builder.drizzleObjectField('User', 'rolesConnection', (t) =>
  t.connection({
    type: Role,
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

In some cases you may want to expose some data from an indirect connection on the edge object.

```typescript
const rolesConnection = drizzleConnectionHelpers(builder, 'userRoles', {
  select: (nestedSelection) => ({
    with: {
      role: nestedSelection(),
    },
  }),
  resolveNode: (userRole) => userRole.role,
});

builder.drizzleObjectFields('User', (t) => ({
  rolesConnection: t.connection(
    {
      type: Role,
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

### `drizzleConnectionHelpers` for non-relation connections

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
    args: {
      userId: t.arg.int({ required: true }),
    },
    nodeNullable: true,
    resolve: async (_, args, ctx, info) => {
      const query = rolesConnection.getQuery(args, ctx, info);
      const userRoles = await db.query.userRoles.findMany({
        ...query,
        where: {
          ...query.where,
          userId: args.userId,
        },
      });
      return rolesConnection.resolve(userRoles, args, ctx);
    },
  }),
}));
