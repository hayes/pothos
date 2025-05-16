# A Basic example using Nest.js

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@nestjs/*`: For building and serving the app
- `@apollo/server`: For executing queries based on incoming requests

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
  posts(skip: Int! = 0, take: Int! = 10): [Post!]!
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
