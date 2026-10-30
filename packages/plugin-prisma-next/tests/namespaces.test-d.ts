import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type ModelName, type Row } from '../src';
import type { Contract } from './namespaces/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

expectTypeOf<ModelName<Types>>().toEqualTypeOf<'nsa.User' | 'nsb.User' | 'Post'>();
expectTypeOf<Row<Types, 'nsb.User'>>().toEqualTypeOf<{ id: string; name: string }>();
expectTypeOf<Row<Types, 'nsa.User'>>().toEqualTypeOf<{ id: number; orgId: number }>();

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});

const orm = null as unknown as {
  nsa: { User: import('../src').CollectionFor<Types, 'nsa.User'> };
  nsb: { User: import('../src').CollectionFor<Types, 'nsb.User'> };
};

// @ts-expect-error A bare name that several namespaces share is ambiguous.
builder.prismaObject('User', { fields: () => ({}) });

builder.prismaObject('nsb.User', {
  fields: (t) => ({
    name: t.exposeString('name'),
    // @ts-expect-error `orgId` belongs to the other namespace's User.
    orgId: t.exposeInt('orgId'),
  }),
});

builder.prismaObject('nsa.User', {
  fields: (t) => ({
    posts: t.relation('posts', {
      query: { where: (post) => post.title.eq('x'), orderBy: (post) => post.id.asc() },
    }),
    // @ts-expect-error `name` is a column of the other namespace's User.
    name: t.exposeString('name'),
  }),
});

builder.prismaObject('Post', {
  fields: (t) => ({
    user: t.relation('user', {
      query: { where: (user) => user.orgId.eq(1) },
    }),
    userWithExtra: t.relation('user', {
      // @ts-expect-error Unknown options are rejected on qualified relation targets too.
      nope: true,
    }),
  }),
});

builder.prismaObject('Post', {
  variant: 'PostWithUser',
  select: { user: true },
  fields: (t) => ({
    orgId: t.int({
      resolve: (row) => {
        expectTypeOf(row.user).toEqualTypeOf<Row<Types, 'nsa.User'> | null>();
        return row.user?.orgId ?? 0;
      },
    }),
  }),
});

// @ts-expect-error Only the contract's model keys are accepted.
builder.prismaObject('nsa.Nope', { fields: () => ({}) });
// @ts-expect-error A qualified name is only valid for a shared model name.
builder.prismaObject('nsa.Post', { fields: () => ({}) });

builder.queryType({
  fields: (t) => ({
    a: t.prismaField({ type: ['nsa.User'], resolve: () => orm.nsa.User }),
    // @ts-expect-error `resolve` is required.
    noResolve: t.prismaField({ type: ['nsa.User'] }),
    // @ts-expect-error Excess options are rejected.
    extra: t.prismaField({ type: ['nsa.User'], resolve: () => orm.nsa.User, nope: 1 }),
    // @ts-expect-error The other namespace's collection returns a different model.
    b: t.prismaField({ type: ['nsb.User'], resolve: () => orm.nsa.User }),
  }),
});
