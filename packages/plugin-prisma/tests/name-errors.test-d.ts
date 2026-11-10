// A mistyped name is reported at the name, not on the call around it.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { it } from 'vitest';
import PrismaPlugin, { type PrismaTypesFromClient, prismaConnectionHelpers } from '../src';
import { prisma } from './example/builder';
import { getDatamodel } from './generated.js';

type PrismaTypes = PrismaTypesFromClient<typeof prisma>;

const builder = new SchemaBuilder<{ PrismaTypes: PrismaTypes }>({
  plugins: [RelayPlugin, PrismaPlugin],
  relay: {},
  prisma: { client: () => prisma, dmmf: getDatamodel() },
});

it('reports a mistyped column at the column', () => {
  builder.prismaObject('User', {
    fields: (t) => ({
      // @ts-expect-error `nme` is not a string column
      name: t.exposeString('nme'),
      // @ts-expect-error `nme` is not a string column
      nullableName: t.exposeString('nme', { nullable: true }),
      // @ts-expect-error `nme` is not an int column
      id: t.exposeInt('nme'),
      // @ts-expect-error `nme` is not a column
      exposed: t.expose('nme', { type: 'String' }),
    }),
  });
});

it('reports a mistyped relation at the relation', () => {
  builder.prismaObject('User', {
    variant: 'UserRelations',
    fields: (t) => ({
      // @ts-expect-error `psts` is not a relation
      posts: t.relation('psts'),
      // @ts-expect-error `psts` is not a list relation
      postCount: t.relationCount('psts'),
      // @ts-expect-error `psts` is not a list relation
      postConnection: t.relatedConnection('psts', { cursor: 'id' }),
      // @ts-expect-error `Usr` is not a variant of the model
      variant: t.variant('Usr'),
    }),
  });
});

it('reports a mistyped cursor at the cursor', () => {
  builder.prismaObject('User', {
    variant: 'UserCursors',
    fields: (t) => ({
      posts: t.relatedConnection('posts', {
        // @ts-expect-error `nme` is not a unique field of Post
        cursor: 'nme',
      }),
    }),
  });

  builder.queryFields((t) => ({
    users: t.prismaConnection({
      type: 'User',
      // @ts-expect-error `nme` is not a unique field of User
      cursor: 'nme',
      resolve: (query) => prisma.user.findMany(query),
    }),
    follows: t.prismaConnection({
      type: 'Follow',
      // @ts-expect-error the composite key is `compositeID`
      cursor: 'compositeId',
      resolve: (query) => prisma.follow.findMany(query),
    }),
  }));

  prismaConnectionHelpers(builder, 'Post', {
    // @ts-expect-error `nme` is not a unique field of Post
    cursor: 'nme',
  });

  builder.prismaNode('Post', {
    variant: 'PostNode',
    id: {
      // @ts-expect-error `nme` is not a unique field of Post
      field: 'nme',
    },
    fields: () => ({}),
  });
});

it('reports a mistyped model name at the name', () => {
  builder.prismaObject(
    // @ts-expect-error `Usr` is not a model
    'Usr',
    { fields: () => ({}) },
  );
  builder.prismaInterface(
    // @ts-expect-error `Usr` is not a model
    'Usr',
    { fields: () => ({}) },
  );
  builder.prismaNode(
    // @ts-expect-error `Usr` is not a model
    'Usr',
    { id: { resolve: () => '' }, fields: () => ({}) },
  );
  builder.prismaObjectFields(
    // @ts-expect-error `Usr` is not a model
    'Usr',
    () => ({}),
  );
  builder.prismaInterfaceField(
    // @ts-expect-error `Usr` is not a model
    'Usr',
    'name',
    (t) => t.string({ resolve: () => '' }),
  );
  prismaConnectionHelpers(
    builder,
    // @ts-expect-error `Usr` is not a model
    'Usr',
    { cursor: 'id' },
  );
  builder.queryFields((t) => ({
    user: t.prismaField({
      // @ts-expect-error `Usr` is not a model
      type: 'Usr',
      resolve: () => {
        throw new Error('not called');
      },
    }),
  }));
});
