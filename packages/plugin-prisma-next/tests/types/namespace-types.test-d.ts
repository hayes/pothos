import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { ModelCallbackTools } from '@prisma/orm-family-sql/orm-client';
import type { NamespaceId } from '@prisma/orm-framework/contract/types';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  type ModelName,
  prismaConnectionHelpers,
  type Row,
} from '../../src';
import type { Contract as SampleContract } from '../fixtures/sample-contract';
import type { Contract } from '../namespaces/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

expectTypeOf<ModelName<Types>>().toEqualTypeOf<'nsa.User' | 'nsb.User' | 'Post' | 'Org'>();
expectTypeOf<Row<Types, 'nsb.User'>>().toEqualTypeOf<{ id: string; name: string }>();
expectTypeOf<Row<Types, 'nsa.User'>>().toEqualTypeOf<{ id: number; orgId: number }>();

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
declare const orm: {
  nsa: { User: CollectionFor<Types, 'nsa.User'> };
  nsb: { User: CollectionFor<Types, 'nsb.User'> };
};

// @ts-expect-error a bare name that several namespaces share is ambiguous
builder.prismaObject('User', { fields: () => ({}) });
// @ts-expect-error only the contract's model keys are accepted
builder.prismaObject('nsa.Nope', { fields: () => ({}) });
// @ts-expect-error a qualified name is only valid for a shared model name
builder.prismaObject('nsa.Post', { fields: () => ({}) });

builder.prismaObject('nsb.User', {
  fields: (t) => ({
    name: t.exposeString('name'),
    // @ts-expect-error `orgId` belongs to the other namespace's User
    orgId: t.exposeInt('orgId'),
  }),
});
builder.prismaObject('nsa.User', {
  fields: (t) => ({
    posts: t.relation('posts', {
      query: { where: (post) => post.title.eq('x'), orderBy: (post) => post.id.asc() },
    }),
    // @ts-expect-error `name` is a column of the other namespace's User
    name: t.exposeString('name'),
  }),
});
builder.prismaObject('Post', {
  select: { user: true },
  fields: (t) => ({
    user: t.relation('user', { query: { where: (user) => user.orgId.eq(1) } }),
    userWithExtra: t.relation('user', {
      // @ts-expect-error unknown options are rejected on qualified relation targets too
      nope: true,
    }),
    orgId: t.int({
      resolve: (post) => {
        expectTypeOf(post.user).toEqualTypeOf<Row<Types, 'nsa.User'>>();
        return post.user.orgId;
      },
    }),
  }),
});
builder.prismaObject('Org', {
  fields: (t) => ({
    users: t.relatedConnection('users', {
      cursor: 'id',
      query: {
        orderBy: (user) => user.orgId.asc(),
        where: (user, tools) => {
          expectTypeOf(tools).toEqualTypeOf<ModelCallbackTools<Contract, 'User', 'nsa'>>();
          // @ts-expect-error `name` is a column of the other namespace's User
          user.name;
          return user.orgId.eq(1);
        },
      },
    }),
    userCount: t.relationCount('users', {
      where: (user, _args, _ctx, tools) => {
        expectTypeOf(tools).toEqualTypeOf<ModelCallbackTools<Contract, 'User', 'nsa'>>();
        return user.orgId.gt(0);
      },
    }),
    badOrder: t.relatedConnection('users', {
      cursor: 'id',
      // @ts-expect-error `name` is a column of the other namespace's User
      query: { orderBy: (user) => user.name.asc() },
    }),
  }),
});
builder.queryType({
  fields: (t) => ({
    a: t.prismaField({ type: ['nsa.User'], resolve: () => orm.nsa.User }),
    // @ts-expect-error `resolve` is required
    noResolve: t.prismaField({ type: ['nsa.User'] }),
    // @ts-expect-error excess options are rejected
    extra: t.prismaField({ type: ['nsa.User'], resolve: () => orm.nsa.User, nope: 1 }),
    // @ts-expect-error the other namespace's collection returns a different model
    b: t.prismaField({ type: ['nsb.User'], resolve: () => orm.nsa.User }),
  }),
});
prismaConnectionHelpers(builder, 'nsa.User', {
  cursor: 'id',
  query: { where: (user) => user.orgId.eq(1) },
});
prismaConnectionHelpers(builder, 'nsb.User', {
  cursor: 'id',
  // @ts-expect-error `orgId` belongs to the other namespace's User
  query: { where: (user) => user.orgId.eq(1) },
});

// Every generated namespace reference relocated, so default-namespace assumptions can't pass.
type Relocate<T> = T extends '__unbound__'
  ? T extends NamespaceId
    ? 'tenant' & NamespaceId
    : 'tenant'
  : T extends string
    ? T
    : T extends readonly unknown[]
      ? { [K in keyof T]: Relocate<T[K]> }
      : T extends (...args: never[]) => unknown
        ? T
        : T extends object
          ? { [K in keyof T as K extends '__unbound__' ? 'tenant' : K]: Relocate<T[K]> }
          : T;
type TenantContract = Relocate<SampleContract>;
type TenantTypes = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: TenantContract }>;
const tenant = new SchemaBuilder<{ PrismaNextContract: TenantContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
expectTypeOf<Row<TenantTypes, 'Post'>['score']>().toEqualTypeOf<number | null>();
prismaConnectionHelpers(tenant, 'Post', {
  cursor: 'id',
  query: {
    where: (post) => {
      // @ts-expect-error accessors keep numeric scalar types outside the default namespace
      post.score.gt('not a number');
      return post.score.gt(1.5);
    },
  },
});
tenant.prismaObject('User', {
  fields: (t) => ({
    posts: t.relation('posts', {
      query: {
        where: (post) => {
          // @ts-expect-error related accessors keep numeric types outside the default namespace
          post.score.eq('not a number');
          return post.score.gt(1.5);
        },
      },
    }),
    score: t.relationAggregate('posts', { op: 'sum', field: 'score' }),
  }),
});
