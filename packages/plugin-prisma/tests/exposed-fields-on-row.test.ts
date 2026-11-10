import SchemaBuilder from '@pothos/core';
import { execute } from '@pothos/test-utils';
import { parse } from 'graphql';
import PrismaPlugin, { type PrismaTypesFromClient } from '../src';
import { prisma, queries } from './example/builder';
import { getDatamodel } from './generated.js';

// On a type with a `select`, an exposed field is read from the row when the row holds it, whether
// or not the planned query loaded the row. Anything else a field needs still reloads the row.
function createSchema() {
  const builder = new SchemaBuilder<{
    PrismaTypes: PrismaTypesFromClient<typeof prisma>;
    Context: {};
  }>({
    plugins: [PrismaPlugin],
    prisma: { client: () => prisma, dmmf: getDatamodel() },
  });

  const User = builder.prismaObject('User', {
    select: { id: true },
    fields: (t) => ({
      id: t.exposeInt('id'),
      email: t.exposeString('email'),
      name: t.exposeString('name', { nullable: true }),
      profile: t.relation('profile', { nullable: true }),
    }),
  });

  builder.prismaObject('Profile', {
    select: { id: true },
    fields: (t) => ({
      bio: t.exposeString('bio', { nullable: true }),
    }),
  });

  const Media = builder.prismaObject('Media', {
    select: { id: true },
    fields: (t) => ({
      id: t.exposeInt('id'),
      url: t.exposeString('url'),
      uploadedById: t.exposeInt('uploadedById', { nullable: true }),
      uploadedBy: t.relation('uploadedBy', { nullable: true }),
    }),
  });

  // Without a `select`, so in include mode.
  const IncludedPost = builder.prismaObject('Post', {
    variant: 'IncludedPost',
    fields: (t) => ({
      id: t.exposeInt('id'),
      title: t.exposeString('title'),
      author: t.relation('author'),
    }),
  });

  builder.queryType({
    fields: (t) => ({
      renamedUser: t.field({
        type: User,
        nullable: true,
        args: { id: t.arg.int({ required: true }), email: t.arg.string({ required: true }) },
        resolve: async (_root, { id, email }) => {
          const row = await prisma.user.findUnique({ where: { id } });

          return row && { ...row, email };
        },
      }),
      missingUser: t.field({
        type: User,
        nullable: true,
        resolve: () => missingUser,
      }),
      users: t.field({
        type: [User],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          prisma.user.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      }),
      userEmails: t.field({
        type: [User],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          prisma.user.findMany({
            select: { id: true, email: true },
            where: { id: { in: ids } },
            orderBy: { id: 'asc' },
          }),
      }),
      plannedUsers: t.prismaField({
        type: [User],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (query, _root, { ids }) =>
          prisma.user.findMany({ ...query, where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      }),
      handBuiltUsers: t.field({
        type: [User],
        resolve: () => handBuiltUsers,
      }),
      media: t.field({
        type: [Media],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          prisma.media.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      }),
      includedPosts: t.field({
        type: [IncludedPost],
        args: { ids: t.arg.intList({ required: true }) },
        resolve: (_root, { ids }) =>
          prisma.post.findMany({ where: { id: { in: ids } }, orderBy: { id: 'asc' } }),
      }),
    }),
  });

  return builder.toSchema();
}

const fixtureUsers = await prisma.user.findMany({
  where: { id: { in: [1, 2, 3] } },
  include: { profile: true },
  orderBy: { id: 'asc' },
});
const user = (id: number) => fixtureUsers.find((row) => row.id === id)!;
const fixturePosts = await prisma.post.findMany({
  where: { id: { in: [1, 102] } },
  include: { author: true },
  orderBy: { id: 'asc' },
});
const post = (id: number) => fixturePosts.find((row) => row.id === id)!;

// Built by hand: the first holds `email`, the second holds the key with nothing in it.
const withEmail = { id: 1, email: user(1).email };
const undefinedEmail = { id: 2, email: undefined };
const handBuiltUsers = [withEmail, undefinedEmail];

// A complete row whose id no user has.
const missingUserId = 999_999;
const missingUser = {
  ...(await prisma.user.findUniqueOrThrow({ where: { id: 1 } })),
  id: missingUserId,
  email: 'not-stored@example.com',
};

const schema = createSchema();

/** The rows the model loader reloaded. */
const reloads = () =>
  queries.filter((query) => (query as { action: string }).action === 'findUniqueOrThrow');

function run(source: string) {
  queries.length = 0;

  return execute({ schema, document: parse(source), contextValue: {} });
}

afterAll(async () => {
  await prisma.$disconnect();
});

describe('exposed fields on rows the plugin did not load', () => {
  it('reads exposed fields from complete rows without reloading them', async () => {
    const result = await run('{ users(ids: [1, 2]) { id email name } }');

    expect(result).toEqual({
      data: {
        users: [1, 2].map((id) => ({ id, email: user(id).email, name: user(id).name })),
      },
    });
    expect(reloads()).toHaveLength(0);
  });

  it('reloads a requested field a hand-built row lacks', async () => {
    const result = await run('{ handBuiltUsers { id name } }');

    expect(result).toEqual({
      data: { handBuiltUsers: [1, 2].map((id) => ({ id, name: user(id).name })) },
    });
    expect(reloads()).toHaveLength(2);
  });

  it('reloads a field whose key the row holds without a value', async () => {
    const result = await run('{ handBuiltUsers { id email } }');

    expect(result).toEqual({
      data: { handBuiltUsers: [1, 2].map((id) => ({ id, email: user(id).email })) },
    });
    expect(reloads()).toHaveLength(1);
  });

  it('reads a null field from the row', async () => {
    const result = await run('{ media(ids: [1, 2]) { id uploadedById } }');

    expect(result).toEqual({
      data: {
        media: [
          { id: 1, uploadedById: null },
          { id: 2, uploadedById: null },
        ],
      },
    });
    expect(reloads()).toHaveLength(0);
  });

  it('reloads a field left out of the query that loaded the row', async () => {
    const result = await run('{ userEmails(ids: [1, 2]) { id email name } }');

    expect(result).toEqual({
      data: {
        userEmails: [1, 2].map((id) => ({ id, email: user(id).email, name: user(id).name })),
      },
    });
    expect(reloads()).toHaveLength(2);
  });

  it('still reloads a to-one relation beside exposed fields', async () => {
    const result = await run(`{
      users(ids: [1, 2]) { id email profile { bio } }
      media(ids: [1]) { url uploadedBy { id } }
    }`);

    expect(user(2).profile).toBeNull();
    expect(result).toEqual({
      data: {
        users: [1, 2].map((id) => ({
          id,
          email: user(id).email,
          profile: user(id).profile && { bio: user(id).profile!.bio },
        })),
        media: [{ url: expect.any(String), uploadedBy: null }],
      },
    });
    expect(reloads()).toHaveLength(3);
  });

  it('returns the value a row holds, not the stored one', async () => {
    expect(user(1).email).not.toBe('changed@example.com');

    const result = await run('{ renamedUser(id: 1, email: "changed@example.com") { id email } }');

    expect(result).toEqual({ data: { renamedUser: { id: 1, email: 'changed@example.com' } } });
    expect(reloads()).toHaveLength(0);
  });

  it('reads exposed fields from a row that is not stored, and errors on a relation', async () => {
    const result = await run('{ missingUser { id email profile { bio } } }');

    expect(result.data).toEqual({
      missingUser: { id: missingUserId, email: 'not-stored@example.com', profile: null },
    });
    expect(result.errors?.map((error) => [error.path, error.message])).toEqual([
      // Prisma's error for the reload, which ends with this line.
      [['missingUser', 'profile'], expect.stringMatching(/No record was found for a query\.$/)],
    ]);
    expect(reloads()).toHaveLength(1);
  });

  it('reads planned rows of a type with a select, and reloads a partial row', async () => {
    const result = await run(`{
      plannedUsers(ids: [1, 2]) { id email }
      handBuiltUsers { id email }
    }`);

    const expected = [1, 2].map((id) => ({ id, email: user(id).email }));

    expect(result).toEqual({ data: { plannedUsers: expected, handBuiltUsers: expected } });
    // The planned query selects only what the type and the fields need.
    expect(queries[0]).toMatchObject({
      action: 'findMany',
      args: { select: { id: true, email: true } },
    });
    expect(reloads()).toHaveLength(1);
  });

  it('leaves include mode as it was', async () => {
    const result = await run('{ includedPosts(ids: [1, 102]) { id title author { id } } }');

    expect(result).toEqual({
      data: {
        includedPosts: [1, 102].map((id) => ({
          id,
          title: post(id).title,
          author: { id: post(id).authorId },
        })),
      },
    });
    expect(reloads()).toHaveLength(2);
  });
});
