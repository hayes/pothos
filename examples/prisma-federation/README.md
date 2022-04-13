# THIS IS STILL A WORK IN PROGRESS AND NOT FULLY FUNCTIONAL

# A relay compatible GraphQL API using Apollo federation with prisma

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@pothos/plugin-federation`: For creating federation compatible schemas
- `@pothos/plugin-prisma`: For prisma based type definitions, and efficient queries
- `@prisma/client`: For querying data from a database
- `prisma`: For running migrations and generating `@prisma/client`
- `apollo-server`: For creating a server that executes the schema

This example is composed of 3 subGraphs (for Comments, Posts, and Users). Each service is
implemented as its own Pothos schema. For simplicity they share a single prisma database, but this
is not a requirement of Pothos.

## Combined Schema

```graphql
type Comment {
  author: User!
  comment: String!
  id: ID!
  post: Post!
}

type Post {
  comments: [Comment!]!
  id: ID!
  author: User!
  content: String!
  title: String!
}

type Query {
  comment(id: ID!): Comment!
  post(id: ID!): Post
  posts(skip: Int, take: Int): [Post!]!
  user(id: ID!): User
}

type User {
  comments: [Comment!]!
  id: ID!
  posts: [Post!]!
  firstName: String!
  fullName: String!
  lastName: String!
}
```
