# A Simple Pothos API with a custom graphql-shield plugin

This example shows how you can create a simple plugin to apply graphql shield rules to your schema

This example uses the following packages:

- `@pothos/core`: For building the schema
- `graphql-yoga`: For creating a server that executes the schema

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
