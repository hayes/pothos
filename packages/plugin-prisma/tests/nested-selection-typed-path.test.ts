import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { gql } from 'graphql-tag';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import type { Post as PostRow } from './client/client.js';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// Two implementations of an interface expose the same field, returning the same model. A path
// handed to `nestedSelection` can pin the implementation a segment is found under with a
// `{ name, type }` segment, like a `queryFromInfo` path can.
const builder = new SchemaBuilder<{
  PrismaTypes: PrismaTypesFromClient<typeof prisma>;
}>({
  plugins: [PrismaPlugin],
  prisma: {
    client: () => prisma,
    dmmf: getDatamodel(),
  },
});

const Post = builder.prismaObject('Post', {
  fields: (t) => ({
    id: t.exposeID('id'),
    author: t.relation('author'),
    comments: t.relation('comments'),
  }),
});

builder.prismaObject('Comment', {
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

interface EntryShape {
  kind: 'draft' | 'post';
  post: PostRow;
}

const Entry = builder.interfaceRef<EntryShape>('Entry').implement({
  fields: (t) => ({
    kind: t.exposeString('kind'),
    post: t.field({
      type: Post,
      resolve: (entry) => entry.post,
    }),
  }),
  resolveType: (entry) => (entry.kind === 'post' ? 'PostEntry' : 'DraftEntry'),
});

builder.objectRef<EntryShape>('PostEntry').implement({ interfaces: [Entry] });
builder.objectRef<EntryShape>('DraftEntry').implement({ interfaces: [Entry] });

const User = builder.prismaObject('User', {
  fields: (t) => ({
    id: t.exposeID('id'),
    entries: t.field({
      type: [Entry],
      select: (_args, _ctx, nestedSelection) => ({
        // Only what is selected on `post` under a fragment on PostEntry is planned.
        posts: nestedSelection({ take: 1 }, [{ name: 'post', type: 'PostEntry' }]),
      }),
      resolve: (user) => user.posts.map((post) => ({ kind: 'post' as const, post })),
    }),
    allEntries: t.field({
      type: [Entry],
      select: (_args, _ctx, nestedSelection) => ({
        // A plain segment merges what every implementation selects on `post`.
        posts: nestedSelection({ take: 1 }, ['post']),
      }),
      resolve: (user) => user.posts.map((post) => ({ kind: 'post' as const, post })),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    user: t.prismaField({
      type: User,
      resolve: (query) => prisma.user.findUniqueOrThrow({ ...query, where: { id: 1 } }),
    }),
  }),
});

const schema = builder.toSchema();

const document = (field: string) => gql`
  query {
    user {
      ${field} {
        kind
        ... on PostEntry {
          post {
            id
            comments {
              id
            }
          }
        }
        ... on DraftEntry {
          post {
            id
            author {
              id
            }
          }
        }
      }
    }
  }
`;

describe('nestedSelection with a typed path segment', () => {
  afterEach(() => {
    queries.length = 0;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('plans only the selection found under the pinned type', async () => {
    const result = await execute({ schema, document: document('entries'), contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(result.data).toEqual({
      user: {
        entries: [
          {
            kind: 'post',
            post: { id: expect.any(String), comments: expect.any(Array) },
          },
        ],
      },
    });
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { take: 1, include: { comments: true } } },
          where: { id: 1 },
        },
      },
    ]);
  });

  it('merges every implementation with a plain segment', async () => {
    const result = await execute({ schema, document: document('allEntries'), contextValue: {} });

    expect(result.errors).toBeUndefined();
    expect(queries).toEqual([
      {
        action: 'findUniqueOrThrow',
        model: 'User',
        args: {
          include: { posts: { take: 1, include: { comments: true, author: true } } },
          where: { id: 1 },
        },
      },
    ]);
  });
});
