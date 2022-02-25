# A relay compatible GraphQL API that uses windowed pagination

This is roughly based on https://artsy.github.io/blog/2020/01/21/graphql-relay-windowed-pagination/

This example uses the following packages:

- `@pothos/core`: For building the schema
- `@pothos/plugin-relay`: For adding relay compatible connections and nodes
- `graphql-yoga`: For creating a server that executes the schema

## Schema

```graphql
type Comment {
  author: User
  comment: String!
  id: ID!
  post: Post!
}

interface Node {
  id: ID!
}

type PageCursor {
  cursor: String!
  isCurrent: Boolean!
  pageNumber: Int!
}

type PageCursors {
  around: [PageCursor!]!
  first: PageCursor!
  last: PageCursor!
}

type PageInfo {
  endCursor: String
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
}

type Post implements Node {
  author: User
  comments(after: ID, before: ID, first: Int, last: Int): PostCommentsConnection!
  content: String!
  id: ID!
  title: String!
}

type PostCommentsConnection {
  edges: [PostCommentsConnectionEdge]!
  pageCursors: PageCursors!
  pageInfo: PageInfo!
}

type PostCommentsConnectionEdge {
  cursor: String!
  node: Comment!
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
  pageCursors: PageCursors!
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
  posts(after: ID, before: ID, first: Int, last: Int): UserPostsConnection!
}

type UserCommentsConnection {
  edges: [UserCommentsConnectionEdge]!
  pageCursors: PageCursors!
  pageInfo: PageInfo!
}

type UserCommentsConnectionEdge {
  cursor: String!
  node: Comment!
}

type UserPostsConnection {
  edges: [UserPostsConnectionEdge]!
  pageCursors: PageCursors!
  pageInfo: PageInfo!
}

type UserPostsConnectionEdge {
  cursor: String!
  node: Post!
}
```
