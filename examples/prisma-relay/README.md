# A relay compatible GraphQL API built with prisma

This example uses the following packages:

- `@giraphql/core`: For building the schema
- `@giraphql/plugin-prism`: For prisma based type definitions, and efficient queries
- `@giraphql/plugin-relay`: For adding relay compatible connections and nodes
- `@prisma/client`: For querying data from a database
- `prisma`: For running migrations and generating `@prisma/client`
- `apollo-server`: For creating a server that executes the schema

## Schema

```graphql
type Comment implements Node {
  author: User!
  comment: String!
  id: ID!
  post: Post!
}

interface Node {
  id: ID!
}

type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
}

type Post implements Node {
  author: User!
  comments: [Comment!]!
  content: String!
  id: ID!
  title: String!
}

type Query {
  node(id: ID!): Node
  nodes(ids: [ID!]!): [Node]!
  post(id: ID!): Post
  posts(after: ID, before: ID, first: Int, last: Int): QueryPostsConnection!
  user(id: ID!): User
}

type QueryPostsConnection {
  edges: [QueryPostsConnectionEdge]!
  pageInfo: PageInfo!
}

type QueryPostsConnectionEdge {
  cursor: String!
  node: Post!
}

type User implements Node {
  comments(after: ID, before: ID, first: Int, last: Int): UserCommentsConnection!
  firstName: String!
  fullName: String!
  id: ID!
  lastName: String!
  posts: [Post!]!
}

type UserCommentsConnection {
  edges: [UserCommentsConnectionEdge]!
  pageInfo: PageInfo!
}

type UserCommentsConnectionEdge {
  cursor: String!
  node: Comment!
}
```
