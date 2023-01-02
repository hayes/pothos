# A GraphQL API built with prisma with subscriptions for basic CRUD mutations

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@pothos/plugin-prisma`: For prisma based type definitions, and efficient queries
- `@prisma/client`: For querying data from a database
- `prisma`: For running migrations and generating `@prisma/client`
- `graphql-yoga`: For creating a server that executes the schema

This is a fairly basic implementation, and may not represent best practices for production, but
should help demonstrate how subscriptions could be implemented.

## Schema

```graphql
type Comment {
  author: User!
  comment: String!
  id: ID!
  post: Post!
}

type Mutation {
  createPost(authorId: ID!, content: String!, title: String!): Post!
  createUser(firstName: String!, lastName: String!): User!
  deletePost(id: ID!): Post
  deleteUser(id: ID!): User
  updatePost(content: String, id: ID!, title: String): Post
  updateUser(firstName: String, id: ID!, lastName: String): User
}

enum MutationType {
  CREATED
  DELETED
  UPDATED
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

type Subscription {
  post(id: ID!): SubscriptionPostEvent
  posts: SubscriptionPostEvent!
  user(id: ID!): SubscriptionUserEvent
  users: SubscriptionUserEvent!
}

interface SubscriptionEvent {
  mutationType: String!
}

type SubscriptionPostEvent implements SubscriptionEvent {
  mutationType: String!
  post: Post
}

type SubscriptionUserEvent implements SubscriptionEvent {
  mutationType: String!
  user: User
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
