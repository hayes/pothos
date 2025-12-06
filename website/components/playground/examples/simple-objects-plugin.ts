import type { PlaygroundExample } from '../types';

export const simpleObjectsPluginExample: PlaygroundExample = {
  id: 'simple-objects-plugin',
  title: 'Simple Objects Plugin',
  description: 'Use the Simple Objects plugin to define objects without separate type definitions',
  files: [
    {
      filename: 'schema.ts',
      content: `import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';

const builder = new SchemaBuilder({
  plugins: [SimpleObjectsPlugin],
});

// Define a simple object for contact information
const ContactInfo = builder.simpleObject('ContactInfo', {
  fields: (t) => ({
    email: t.string({
      nullable: false,
    }),
    phoneNumber: t.string({
      nullable: true,
    }),
    website: t.string({
      nullable: true,
    }),
  }),
});

// Define a simple interface for entities with IDs
const Node = builder.simpleInterface('Node', {
  fields: (t) => ({
    id: t.id({
      nullable: false,
    }),
  }),
});

// Define a User type with simpleObject
const User = builder.simpleObject(
  'User',
  {
    interfaces: [Node],
    fields: (t) => ({
      firstName: t.string(),
      lastName: t.string(),
      age: t.int(),
      contactInfo: t.field({
        type: ContactInfo,
        nullable: false,
      }),
    }),
  },
  // Add computed fields with resolvers
  (t) => ({
    fullName: t.string({
      resolve: (user) => \`\${user.firstName} \${user.lastName}\`,
    }),
    isAdult: t.boolean({
      resolve: (user) => user.age >= 18,
    }),
  }),
);

// Define a Post type
const Post = builder.simpleObject(
  'Post',
  {
    interfaces: [Node],
    fields: (t) => ({
      title: t.string(),
      content: t.string(),
      published: t.boolean(),
      authorId: t.id(),
    }),
  },
  // Add resolver fields
  (t) => ({
    excerpt: t.string({
      resolve: (post) => \`\${post.content.substring(0, 100)}...\`,
    }),
    status: t.string({
      resolve: (post) => post.published ? 'Published' : 'Draft',
    }),
  }),
);

// Define Comment type
const Comment = builder.simpleObject(
  'Comment',
  {
    interfaces: [Node],
    fields: (t) => ({
      text: t.string(),
      postId: t.id(),
      authorId: t.id(),
      createdAt: t.string(),
    }),
  },
  (t) => ({
    preview: t.string({
      resolve: (comment) => {
        return comment.text.length > 50
          ? \`\${comment.text.substring(0, 50)}...\`
          : comment.text;
      },
    }),
  }),
);

// Query type
builder.queryType({
  fields: (t) => ({
    user: t.field({
      type: User,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, args) => ({
        id: args.id,
        firstName: 'Jane',
        lastName: 'Doe',
        age: 28,
        contactInfo: {
          email: 'jane@example.com',
          phoneNumber: '+1-555-0123',
          website: 'https://janedoe.com',
        },
      }),
    }),
    post: t.field({
      type: Post,
      args: {
        id: t.arg.id({ required: true }),
      },
      resolve: (_, args) => ({
        id: args.id,
        title: 'Introduction to Pothos Simple Objects',
        content: 'The Simple Objects plugin makes it easy to define GraphQL types without needing separate TypeScript type definitions. This reduces boilerplate while maintaining full type safety.',
        published: true,
        authorId: '1',
      }),
    }),
    comments: t.field({
      type: [Comment],
      args: {
        postId: t.arg.id({ required: true }),
      },
      resolve: (_, args) => [
        {
          id: '1',
          text: 'Great article! Very helpful.',
          postId: args.postId,
          authorId: '2',
          createdAt: new Date('2024-01-15').toISOString(),
        },
        {
          id: '2',
          text: 'Thanks for sharing this. The Simple Objects plugin really simplifies schema building.',
          postId: args.postId,
          authorId: '3',
          createdAt: new Date('2024-01-16').toISOString(),
        },
      ],
    }),
  }),
});

export const schema = builder.toSchema();`,
    },
  ],
  defaultQuery: `query {
  user(id: "1") {
    id
    firstName
    lastName
    fullName
    age
    isAdult
    contactInfo {
      email
      phoneNumber
      website
    }
  }
  post(id: "1") {
    id
    title
    excerpt
    status
  }
  comments(postId: "1") {
    id
    preview
    createdAt
  }
}`,
};
