import type { PlaygroundExample } from '../types';

export const enumsArgsExample: PlaygroundExample = {
  id: 'enums-args',
  title: 'Enums & Arguments',
  description: 'Define enums and use typed arguments',
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Define an enum
const Status = builder.enumType('Status', {
  values: ['DRAFT', 'PUBLISHED', 'ARCHIVED'] as const,
});

// Define a Post type using the enum
const Post = builder.objectRef<{
  id: string;
  title: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
}>('Post');

builder.objectType(Post, {
  fields: (t) => ({
    id: t.exposeID('id'),
    title: t.exposeString('title'),
    status: t.field({
      type: Status,
      resolve: (post) => post.status,
    }),
  }),
});

// Sample data
const posts = [
  { id: '1', title: 'Hello World', status: 'PUBLISHED' as const },
  { id: '2', title: 'Draft Post', status: 'DRAFT' as const },
  { id: '3', title: 'Old News', status: 'ARCHIVED' as const },
];

builder.queryType({
  fields: (t) => ({
    posts: t.field({
      type: [Post],
      args: {
        status: t.arg({ type: Status, required: false }),
        limit: t.arg.int({ required: false }),
      },
      resolve: (_, args) => {
        let result = posts;
        if (args.status) {
          result = result.filter((p) => p.status === args.status);
        }
        if (args.limit) {
          result = result.slice(0, args.limit);
        }
        return result;
      },
    }),
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  defaultQuery: `query {
  allPosts: posts {
    id
    title
    status
  }
  publishedOnly: posts(status: PUBLISHED) {
    title
    status
  }
}`,
};
