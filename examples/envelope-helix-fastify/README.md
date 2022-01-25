# A GraphQL schema wrapped with envelop

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@envelop/core`: For wrapping schema execution with additional logic
- `graphql-helix`: For parsing and processing requests
- `fastify`: For routing and starting the http server

## Schema

```graphql
type Comment {
  author: User
  comment: String!
  id: ID!
  post: Post!
}

type Post {
  author: User
  comments: [Comment!]!
  content: String!
  id: ID!
  title: String!
}

type Query {
  post(id: ID!): Post
  posts(skip: Int, take: Int): [Post!]
  user(id: ID!): User
}

type User {
  comments: [Comment!]!
  firstName: String!
  fullName: String!
  id: ID!
  lastName: String!
  posts: [Post!]!
}
```
