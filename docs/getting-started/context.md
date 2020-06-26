---
name: Using Context
menu: Guide
---

# Context object

The GraphQL context object can be used to give every resolver in the schema access to some shared state for the current request. One common use case is to store the current User on the context object.

One important thing to note about GiraphQL is that every request is assumed to have a new unique context object, so be sure to set up your context objects in a way that they are unique to each request.

First lets define a User class that holds information about a user, and create a SchemaBuilder with a Context type that has a currentUser property.

```typescript
class User {
    id: string;
    firstName: string;
    username: string;

    constructor(id: string, firstName: string, username: string) {
        this.id = id;
        this.firstName = firstName;
        this.username = username;
    }
}

const builder = new SchemaBuilder<{
    Context: {
        currentUser: User;
    };
}>({});
```

Next, we will want to add something in our schema that uses the current user:

```typescript
builder.queryType({
    fields: (t) => ({
        currentUser: t.field({
            type: User,
            resolve: (root, args, context) => context.currentUser,
        }),
    }),
});

builder.objectType(User, {
    fields: (t) => ({
        id: t.exposeID('id', {}),
        firstName: t.exposeString('firstName', {}),
        username: t.exposeString('username', {}),
    }),
});
```

Finally, we need to actually create our context when a request is craeted.

```typescript
const server = new ApolloServer({
    schema,
    context: async ({ req }) => ({
        currentUser: await getUserFromAuthHeader(req.headers.authorization),
    }),
});

server.listen(3000);
```

