# A GraphQL API built with graphql-helix

This example uses the following packages:

- `@giraphql/core`: For building the schema
- `@giraphql/plugin-prism`: For prisma based type definitions, and efficient queries
- `graphql-helix`: For executing queries based on incoming requests

## Schema

```graphql
type Comment {
  author: User!
  comment: String!
  id: ID!
  post: Post!
}

type Post {
  author: User!
  comments: [Comment!]!
  content: String!
  id: ID!
  title: String!
}

type Query {
  post(id: ID!): Post
  posts(skip: Int, take: Int): [Post!]!
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
