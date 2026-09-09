/**
 * Code samples for the theme editor previews. Picked to exercise as
 * many syntax kinds as possible per language.
 */

export interface Sample {
  language: string;
  filename: string;
  code: string;
}

const TYPESCRIPT_SAMPLE = `// Pothos schema with multiple syntax kinds
import SchemaBuilder from '@pothos/core';

interface Context {
  user?: { id: string; name: string };
}

type UserRole = 'admin' | 'member' | 'guest';

const builder = new SchemaBuilder<{ Context: Context }>();

builder.objectType('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    role: t.field({
      type: 'String',
      resolve: (_user, _args, ctx) => ctx.user?.name ?? 'guest',
    }),
    posts: t.field({
      type: ['Post'],
      args: { limit: t.arg.int({ defaultValue: 10 }) },
      resolve: async (_, args) => fetchPosts(args.limit),
    }),
  }),
});

const SECRET = 0x42;
const FLAGS = /^[a-z]+$/gi;

function fetchPosts(limit: number): Promise<unknown[]> {
  return Promise.resolve([]);
}

@deprecated('Use builder.toSchema()')
class Legacy {}
`;

const GRAPHQL_SAMPLE = `# A query with most kinds present
query GetUserWithPosts($id: ID!, $limit: Int = 10) {
  user(id: $id) {
    id
    name
    role
    posts(limit: $limit) @include(if: true) {
      id
      title
      publishedAt
    }
  }
}

mutation CreatePost($input: CreatePostInput!) {
  createPost(input: $input) {
    ... on Post { id title }
    ... on Error { message code }
  }
}

type Post implements Node & Timestamped {
  id: ID!
  title: String!
  publishedAt: DateTime
}

input CreatePostInput {
  title: String!
  body: String
}

scalar DateTime
`;

const JSON_SAMPLE = `{
  "name": "@pothos/playground-demo",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "build": "next build",
    "dev": "next dev"
  },
  "settings": {
    "theme": "pothos-forest-dark",
    "fontSize": 13,
    "tabSize": 2,
    "wordWrap": true
  },
  "tags": ["graphql", "schema", "typescript"],
  "active": false,
  "weight": null
}
`;

const MARKDOWN_SAMPLE = `# Pothos GraphQL

Pothos is a *plugin-based* **GraphQL schema builder**.

## Quick start

\`\`\`ts
const builder = new SchemaBuilder({});
\`\`\`

- One ecosystem
- Every shape
- Type-safe by design

> Pothos is the schema builder we wish we'd had.

[Read the docs →](/docs)
`;

export const SAMPLES: Sample[] = [
  { language: 'typescript', filename: 'schema.ts', code: TYPESCRIPT_SAMPLE },
  { language: 'graphql', filename: 'query.graphql', code: GRAPHQL_SAMPLE },
  { language: 'json', filename: 'package.json', code: JSON_SAMPLE },
  { language: 'markdown', filename: 'README.md', code: MARKDOWN_SAMPLE },
];
