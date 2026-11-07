import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { ModelCallbackTools } from '@prisma/orm-family-sql/orm-client';
import type { NamespaceId } from '@prisma/orm-framework/contract/types';
import { expectTypeOf } from 'vitest';
import PrismaNextPlugin, {
  type CollectionFor,
  type ModelKey,
  type PlannedRowBrand,
  prismaConnectionHelpers,
  type Row,
} from '../../src';
import type { Contract as SampleContract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance-namespaces/contract';
import type { Contract } from '../namespaces/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

expectTypeOf<ModelKey<Types>>().toEqualTypeOf<'nsa.User' | 'nsa.Post' | 'nsa.Org' | 'nsb.User'>();
expectTypeOf<Row<Types, 'nsb.User'>>().toEqualTypeOf<{ id: string; name: string }>();
expectTypeOf<Row<Types, 'nsa.User'>>().toEqualTypeOf<{ id: number; orgId: number }>();

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
declare const orm: {
  nsa: { User: CollectionFor<Types, 'nsa.User'> };
  nsb: { User: CollectionFor<Types, 'nsb.User'> };
};

// @ts-expect-error a bare name isn't a key in a contract with several namespaces
builder.prismaObject('User', { fields: () => ({}) });
// @ts-expect-error only the contract's model keys are accepted
builder.prismaObject('nsa.Nope', { fields: () => ({}) });
// @ts-expect-error every key is qualified in a contract with several namespaces, even a unique name
builder.prismaObject('Post', { fields: () => ({}) });
// @ts-expect-error `Post` is only in `nsa`
builder.prismaObject('nsb.Post', { fields: () => ({}) });

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
      query: { where: (post) => post.title.eq('x'), orderBy: { id: 'asc' } },
    }),
    // @ts-expect-error `name` is a column of the other namespace's User
    name: t.exposeString('name'),
  }),
});
builder.prismaObject('nsa.Post', {
  select: { user: true },
  fields: (t) => ({
    user: t.relation('user'),
    userWithExtra: t.relation('user', {
      // @ts-expect-error unknown options are rejected on qualified relation targets too
      nope: true,
    }),
    orgId: t.int({
      resolve: (post) => {
        expectTypeOf(post.user).toEqualTypeOf<
          Row<Types, 'nsa.User'> & PlannedRowBrand<'nsa.User'>
        >();
        return post.user.orgId;
      },
    }),
  }),
});
builder.prismaObject('nsa.Org', {
  fields: (t) => ({
    users: t.relatedConnection('users', {
      query: {
        orderBy: { orgId: 'asc' },
        where: (user, tools) => {
          expectTypeOf(tools).toEqualTypeOf<ModelCallbackTools<Contract, 'User', 'nsa'>>();
          // @ts-expect-error `name` is a column of the other namespace's User
          user.name;
          return user.orgId.eq(1);
        },
      },
    }),
    userCount: t.relationCount('users', {
      query: () => ({
        where: (user, tools) => {
          expectTypeOf(tools).toEqualTypeOf<ModelCallbackTools<Contract, 'User', 'nsa'>>();
          return user.orgId.gt(0);
        },
      }),
    }),
    badOrder: t.relatedConnection('users', {
      // @ts-expect-error `name` is a column of the other namespace's User
      query: { orderBy: { name: 'asc' } },
    }),
  }),
});
builder.queryType({
  fields: (t) => ({
    a: t.prismaField({ type: ['nsa.User'], collection: () => orm.nsa.User }),
    all: t.prismaField({ type: ['nsa.User'] }),
    // @ts-expect-error a single-row field needs `collection`, `query` or `resolve`
    noResolve: t.prismaField({ type: 'nsa.User' }),
    // @ts-expect-error excess options are rejected
    extra: t.prismaField({ type: ['nsa.User'], collection: () => orm.nsa.User, nope: 1 }),
    // @ts-expect-error the other namespace's collection returns a different model
    b: t.prismaField({ type: ['nsb.User'], collection: () => orm.nsa.User }),
    bPage: t.prismaConnection({
      type: 'nsb.User',
      // @ts-expect-error the other namespace's collection returns a different model
      collection: () => orm.nsa.User,
    }),
  }),
});
builder.prismaNode('nsb.User', {
  name: 'NsbNode',
  id: { field: 'id' },
  collection: () => orm.nsb.User,
  fields: () => ({}),
});
builder.prismaNode('nsb.User', {
  name: 'WrongNsbNode',
  id: { field: 'id' },
  // @ts-expect-error `M` comes from the model key, so the other namespace's collection can't widen it
  collection: () => orm.nsa.User,
  fields: () => ({}),
});
builder.prismaNode('nsb.User', {
  name: 'PlainCollectionNode',
  id: { field: 'id' },
  // @ts-expect-error `collection` is a function, so it can't stay bound to the build-time client
  collection: orm.nsb.User,
  fields: () => ({}),
});
prismaConnectionHelpers(builder, 'nsa.User', {
  query: { where: (user) => user.orgId.eq(1) },
});
prismaConnectionHelpers(builder, 'nsb.User', {
  // @ts-expect-error `orgId` belongs to the other namespace's User
  query: { where: (user) => user.orgId.eq(1) },
});

builder.prismaObject('nsa.Post', {
  variant: 'LimitedNamespacedSelect',
  // @ts-expect-error a to-one relation in a type's select takes only true under a qualified key too
  select: { user: { limit: 1 } },
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
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
expectTypeOf<Row<TenantTypes, 'Post'>['score']>().toEqualTypeOf<number | null>();
// A single named namespace keeps bare keys, and its qualified form isn't one.
expectTypeOf<ModelKey<TenantTypes>>().toEqualTypeOf<'Comment' | 'Post' | 'PostView' | 'User'>();
// @ts-expect-error a contract with one namespace has bare keys
tenant.prismaObject('tenant.Post', { fields: () => ({}) });
prismaConnectionHelpers(tenant, 'Post', {
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
    score: t.float({
      nullable: true,
      select: { score: { posts: (posts) => posts.sum('score') } },
      resolve: (user) => {
        expectTypeOf(user.score).toEqualTypeOf<number | null>();
        return user.score;
      },
    }),
  }),
});

// Both `Task` hierarchies given one variant value, so only the namespace tells their `Bug`s apart.
type RenameVariant<T> = T extends string
  ? T
  : T extends readonly unknown[]
    ? { [K in keyof T]: RenameVariant<T[K]> }
    : T extends (...args: never[]) => unknown
      ? T
      : T extends object
        ? { [K in keyof T as K extends 'b' ? 'bug' : K]: RenameVariant<T[K]> }
        : T;
type SameValueContract = RenameVariant<InheritanceContract>;
type SameValueTypes = PothosSchemaTypes.ExtendDefaultTypes<{
  PrismaNextContract: SameValueContract;
}>;
const sameValue = new SchemaBuilder<{ PrismaNextContract: SameValueContract }>({
  plugins: [RelayPlugin, PrismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
declare const sameValueOrm: {
  inha: { Task: CollectionFor<SameValueTypes, 'inha.Task'> };
  inhb: { Task: CollectionFor<SameValueTypes, 'inhb.Task'> };
};
const inhaBug = sameValueOrm.inha.Task.variant('bug');
const inhbBug = sameValueOrm.inhb.Task.variant('bug');
expectTypeOf(inhaBug.modelName).toEqualTypeOf(inhbBug.modelName);
sameValue.prismaNode('inha.Bug', {
  name: 'ABug',
  id: { field: 'id' },
  collection: () => inhaBug,
  fields: () => ({}),
});
sameValue.prismaNode('inhb.Bug', {
  name: 'BBug',
  id: { field: 'id' },
  collection: () => inhbBug,
  fields: () => ({}),
});
sameValue.prismaNode('inha.Bug', {
  name: 'CrossedBug',
  id: { field: 'id' },
  // @ts-expect-error the same model name and variant value in another namespace
  collection: () => inhbBug,
  fields: () => ({}),
});
sameValue.queryType({
  fields: (t) => ({
    bugs: t.prismaField({ type: ['inha.Bug'], collection: () => inhaBug }),
    // @ts-expect-error the same model name and variant value in another namespace
    crossed: t.prismaField({ type: ['inha.Bug'], collection: () => inhbBug }),
    // A variant loads through its base, whose namespace can differ from its own.
    chores: t.prismaField({
      type: ['inhb.Chore'],
      collection: () => sameValueOrm.inha.Task.variant('chore'),
    }),
  }),
});

// A select function's collection is the related model's, in its own namespace.
builder.prismaObject('nsa.Org', {
  variant: 'OrgSelectFunctions',
  fields: (t) => ({
    members: t.int({
      select: { members: { users: (sub) => sub.where({ orgId: 1 }).count() } },
      resolve: (org) => org.members,
    }),
    nsbColumn: t.int({
      select: {
        // @ts-expect-error `name` is a column of `nsb.User`, not of `nsa.User`
        named: { users: (sub) => sub.where({ name: 'x' }).count() },
      },
      resolve: () => 0,
    }),
  }),
});
