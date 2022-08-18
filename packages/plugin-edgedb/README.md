# EdgeDB Plugin for Pothos

This plugin provides tighter integration with `edgedb`, making it easier to define edgedb based
object types.

## Example

Here is a quick example of what an API using this plugin might look like. There is a more thorough
breakdown of what the methods and options used in the example below.

```typescript
// Create an object type based on a edgedb model
// without providing any custom type information
builder.edgeDBObject('User', {
  fields: (t) => ({
    // expose fields from the database
    id: t.exposeID('id'),
    email: t.exposeString('email'),
    name: t.exposeString('name', { nullable: true }),
    // Multi Link field for Users Posts
    posts: t.link("posts"),
  }),
});

builder.queryType({
  fields: (t) => ({
    // Define a field that issues an optimized edgedb query
    me: t.edgeDBField({
      type: 'User',
      resolve: async (query, root, args, ctx, info) => {
            const db_query = e
                .select(e.User, (user) => {
                    // the `query` argument will add in the `select`s fields to
                    // resolve as much of the request in a single query as possible
                    ...query,
                    filter: e.op(user.id, '=', ctx.user.id),
                });

            return await db.run(db_query);
      }
    }),
  }),
});
```

Given this schema, you would be able to resolve a query like the following with a single edgedb
query.

```graphql
query {
  me {
    email
    posts {
      title
      author {
        id
      }
    }
  }
}
```

## EdgeDB Expressions

The `e` variable provides everything you need to build an edgedb query. All EdgeQL commands,
standard library functions, and types are available as properties on e.

[Source](https://www.edgedb.com/docs/clients/js/querybuilder#expressions)

```ts
import e from './dbschema/edgeql-js';

// commands
e.select;
e.insert;
e.update;
e.delete;

// types
e.str;
e.bool;
e.cal.local_date;
e.User;
e.Post;
e....;

// functions
e.str_upper;
e.len;
e.count;
e.math.stddev;
```
