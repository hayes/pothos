# A Basic fullstack example using Next.js

This example uses the following packages:

- `@pothos/core`: For building the schema
- `graphql-helix`: For executing queries based on incoming requests
- `next`: For building and serving the app
- `@apollo/client`: For making graphql requests from the front-end
- `graphql-codegen/cli`: For generating `schema.graphql` and typescript types for client queries
- `@boost/module`: For loading the typescript files that describe the graphql schema for
  graphql-code-generator

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
