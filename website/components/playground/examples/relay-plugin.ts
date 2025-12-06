import type { PlaygroundExample } from '../types';

export const relayPluginExample: PlaygroundExample = {
  id: 'relay-plugin',
  title: 'Relay Plugin',
  description: 'Use the Relay plugin for cursor-based pagination and global IDs',
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';

const builder = new SchemaBuilder({
  plugins: [RelayPlugin],
  relay: {
    // Configure relay options
    clientMutationId: 'omit',
    cursorType: 'String',
  },
});

// Mock data
const posts = [
  { id: '1', title: 'First Post', content: 'Hello World', published: true },
  { id: '2', title: 'Second Post', content: 'GraphQL is awesome', published: true },
  { id: '3', title: 'Third Post', content: 'Relay makes pagination easy', published: false },
  { id: '4', title: 'Fourth Post', content: 'Pothos is type-safe', published: true },
  { id: '5', title: 'Fifth Post', content: 'Building APIs is fun', published: true },
];

const users = [
  { id: '1', name: 'Alice', email: 'alice@example.com' },
  { id: '2', name: 'Bob', email: 'bob@example.com' },
  { id: '3', name: 'Charlie', email: 'charlie@example.com' },
];

// Define User and Post refs
const UserRef = builder.objectRef<{ id: string; name: string; email: string }>('User');
const PostRef = builder.objectRef<{ id: string; title: string; content: string; published: boolean }>('Post');

// Define a User node
const User = builder.node(UserRef, {
  id: {
    resolve: (user) => user.id,
  },
  loadOne: (id) => users.find((u) => u.id === id) || null,
  loadMany: (ids) => ids.map((id) => users.find((u) => u.id === id) || null),
  fields: (t) => ({
    name: t.exposeString('name'),
    email: t.exposeString('email'),
  }),
});

// Define a Post node
const Post = builder.node(PostRef, {
  id: {
    resolve: (post) => post.id,
  },
  loadOne: (id) => posts.find((p) => p.id === id) || null,
  loadMany: (ids) => ids.map((id) => posts.find((p) => p.id === id) || null),
  fields: (t) => ({
    title: t.exposeString('title'),
    content: t.exposeString('content'),
    published: t.exposeBoolean('published'),
  }),
});

// Query with connection fields
builder.queryType({
  fields: (t) => ({
    // Connection for posts with cursor-based pagination
    posts: t.connection({
      type: Post,
      resolve: (parent, args) => {
        // Simple implementation - in production you'd query from a database
        return {
          edges: posts.map((post, index) => ({
            cursor: \`cursor:\${index}\`,
            node: post,
          })),
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: 'cursor:0',
            endCursor: \`cursor:\${posts.length - 1}\`,
          },
        };
      },
    }),

    // Connection for users
    users: t.connection({
      type: User,
      resolve: () => ({
        edges: users.map((user, index) => ({
          cursor: \`cursor:\${index}\`,
          node: user,
        })),
        pageInfo: {
          hasNextPage: false,
          hasPreviousPage: false,
          startCursor: 'cursor:0',
          endCursor: \`cursor:\${users.length - 1}\`,
        },
      }),
    }),

    // Single node lookup by global ID
    // This is automatically provided by the relay plugin as 'node' field
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  defaultQuery: `# Query posts with connection/pagination
query PostsConnection {
  posts(first: 3) {
    edges {
      cursor
      node {
        id
        title
        content
        published
      }
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
    }
  }
}

# Query users connection
query UsersConnection {
  users(first: 2) {
    edges {
      cursor
      node {
        id
        name
        email
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}

# Query a specific node by global ID
query NodeQuery {
  node(id: "UG9zdDox") {
    id
    ... on Post {
      title
      content
    }
    ... on User {
      name
      email
    }
  }
}`,
};
