# A GraphQL API built with prisma with subscriptions for basic CRUD mutations

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@pothos/plugin-prisma`: For prisma based type definitions, and efficient queries
- `@pothos/plugin-smart-subscriptions`: For automatically create subscription from db query
- `@prisma/client`: For querying data from a database
- `prisma`: For running migrations and generating `@prisma/client`
- `@apollo/server`: For creating a server that executes the schema
- `express`: Mandatory for Apollo v4 subscriptions

This is a fairly basic implementation, and may not represent best practices for production, but
should help demonstrate how smart subscriptions could be implemented.

## Schema

```graphql
type Comment {
  author: User!
  comment: String!
  id: ID!
  post: Post!
}

type Mutation {
  createOneUser(firstName: String!, lastName: String!): User!
}

type Post {
  author: User!
  comments: [Comment!]!
  content: String!
  id: ID!
  title: String!
}

type Query {
  countManyUser: Int!
}

type Subscription {
  countManyUser: Int!
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
