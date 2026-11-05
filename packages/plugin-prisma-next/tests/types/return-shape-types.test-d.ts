// A field returning a prisma type resolves to a row holding the type's key and the columns and
// to-one relations its select loads, since plugins listed before this one read the row before any
// reload.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import type { PostgresClient } from '@prisma/orm-postgres/runtime';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, {
  type CollectionFor,
  collectionFromInfo,
  type PlannedRow,
  type PlannedRowBrand,
  prismaConnectionHelpers,
} from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';
import type { Contract as InheritanceNamespacesContract } from '../inheritance-namespaces/contract';
import type { Contract as NamespacesContract } from '../namespaces/contract';

declare const client: SqliteClient<Contract>;
type UserRow = DefaultModelRow<Contract, 'User'>;
type PostRow = DefaultModelRow<Contract, 'Post'>;
declare const postRow: PostRow;
declare const postWithAuthor: PostRow & { author: UserRow };

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
const Node = builder.nodeInterfaceRef();

const Titled = builder.prismaObject('Post', {
  variant: 'Titled',
  select: ['title'],
  fields: (t) => ({ title: t.exposeString('title') }),
});
const Authored = builder.prismaNode('Post', {
  variant: 'Authored',
  id: { field: 'id' },
  select: { title: true, author: true, comments: true },
  fields: (t) => ({ author: t.string({ resolve: (post) => post.author.firstName }) }),
});
const Plain = builder.prismaObject('Post', { variant: 'PlainPost', fields: () => ({}) });

builder.queryType({
  fields: (t) => ({
    // @ts-expect-error the type selects `title`, which the row lacks
    keyOnly: t.field({ type: Titled, resolve: () => ({ id: 'p' }) }),
    withColumn: t.field({ type: Titled, resolve: () => ({ id: 'p', title: 'Hello' }) }),
    // A whole ORM row holds every column.
    ormRow: t.field({ type: Titled, nullable: true, resolve: () => client.orm.Post.first() }),
    ormRows: t.field({ type: [Titled], resolve: () => client.orm.Post.all() }),
    rowList: t.field({ type: [Titled], resolve: async () => [postRow] }),
    // A type without a select needs only the key.
    plainKey: t.field({ type: Plain, resolve: () => ({ id: 'p' }) }),
    // @ts-expect-error the type selects the `author` relation, which a plain row lacks
    noAuthor: t.field({ type: Authored, resolve: () => postRow }),
    // To-many relations reload, so a row needn't hold `comments`.
    withAuthor: t.field({ type: Authored, resolve: () => postWithAuthor }),
    included: t.field({
      type: Authored,
      nullable: true,
      resolve: () => client.orm.Post.include('author').first(),
    }),
    // A non-prisma interface takes a branded row.
    node: t.field({ type: Node, resolve: () => Authored.addBrand(postWithAuthor) }),
    nodes: t.field({ type: [Node], resolve: () => Authored.addBrand([postWithAuthor]) }),
  }),
});

// @ts-expect-error a branded row must hold what the type's select loads
Authored.addBrand(postRow);
// @ts-expect-error a branded row must hold the type's key
Titled.addBrand({ title: 'Hello' });
Titled.addBrand({ id: 'p', title: 'Hello' });

// resolveType reads what every row a field returning the interface holds, before any reload: the
// columns and to-one relations of the interface's select, but not its to-many relations or
// computed values.
builder.prismaInterface('Post', {
  variant: 'Routed',
  select: {
    title: true,
    author: true,
    comments: true,
    views: (sub) => ({ viewCount: sub.count() }),
  },
  resolveType: (post) => {
    expectTypeOf(post.id).toEqualTypeOf<string>();
    expectTypeOf(post.title).toEqualTypeOf<string>();
    expectTypeOf(post.author).toEqualTypeOf<UserRow>();
    // @ts-expect-error a returned row needn't hold a to-many relation
    post.comments;
    // @ts-expect-error a returned row needn't hold a computed value
    post.viewCount;
    // @ts-expect-error not in the select
    post.published;
    return 'RoutedPost';
  },
  fields: () => ({}),
});

// An annotated parameter is checked against the parent, not inferred into the interface's shape.
builder.prismaInterface('User', {
  variant: 'AnnotatedRouted',
  select: ['email'],
  resolveType: (user: { id: string; email: string }) => (user.email ? 'A' : 'B'),
  fields: (t) => ({ email: t.exposeString('email') }),
});
builder.prismaInterface('User', {
  variant: 'WrongAnnotatedRouted',
  select: ['email'],
  // @ts-expect-error `firstName` isn't in the select
  resolveType: (user: { id: string; firstName: string }) => (user.firstName ? 'A' : 'B'),
  fields: (t) => ({ email: t.exposeString('email') }),
});

// A prismaInterface of a discriminated model also needs the discriminator.
const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { client: null as never },
});
type TaskRow = DefaultModelRow<InheritanceContract, 'Task'>;
declare const taskRow: TaskRow;
const Task = inheritance.prismaInterface('Task', {
  select: ['title'],
  fields: (t) => ({ title: t.exposeString('title') }),
});
const Bug = inheritance.prismaObject('Bug', {
  interfaces: [Task],
  select: ['severity'],
  fields: (t) => ({ severity: t.exposeString('severity') }),
});
inheritance.prismaObject('Feature', { interfaces: [Task], fields: () => ({}) });
inheritance.queryType({
  fields: (t) => ({
    task: t.field({ type: Task, resolve: () => taskRow }),
    // @ts-expect-error the interface routes rows by the discriminator `type`
    noDiscriminator: t.field({ type: Task, resolve: () => ({ id: 't', title: 'x' }) }),
    withDiscriminator: t.field({
      type: Task,
      resolve: () => ({ id: 't', title: 'x', type: 'bug' as const }),
    }),
    // A variant's type needs its own select and its interfaces'.
    bug: t.field({ type: Bug, resolve: () => ({ id: 't', title: 'x', severity: 'high' }) }),
    // @ts-expect-error the variant type selects `severity`
    bugWithoutSeverity: t.field({ type: Bug, resolve: () => ({ id: 't', title: 'x' }) }),
    // @ts-expect-error the interface it implements selects `title`
    bugWithoutTitle: t.field({ type: Bug, resolve: () => ({ id: 't', severity: 'high' }) }),
  }),
});

// A row the loader planned fits a type of its model, whatever the type's select, since the query
// planned that select into it. Only a planned row of the type's model, or of a variant of it, fits.
type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
type InheritanceTypes = PothosSchemaTypes.ExtendDefaultTypes<{
  PrismaNextContract: InheritanceContract;
}>;
declare const plannedPost: PlannedRow<Types, 'Post'>;
declare const plannedComment: PlannedRow<Types, 'Comment'>;
declare const plannedTask: PlannedRow<InheritanceTypes, 'Task'>;
declare const plannedBug: PlannedRow<InheritanceTypes, 'Bug'>;
declare const plannedFeature: PlannedRow<InheritanceTypes, 'Feature'>;
declare const info: GraphQLResolveInfo;
declare const inheritanceClient: SqliteClient<InheritanceContract>;

builder.queryFields((t) => ({
  plannedPost: t.field({ type: Authored, resolve: () => plannedPost }),
  // @ts-expect-error a planned row of another model
  plannedComment: t.field({ type: Authored, resolve: () => plannedComment }),
  // @ts-expect-error a planned row of another model, beneath a non-null list
  plannedComments: t.field({ type: [Titled], resolve: () => [plannedComment] }),
}));

declare const plannedTaskWithType: PlannedRow<InheritanceTypes, 'Task'> & { type: string };
inheritance.queryFields((t) => ({
  plannedTask: t.field({ type: Task, resolve: () => plannedTaskWithType }),
  // @ts-expect-error a row planned for another type of the model may lack the discriminator
  plannedTaskWithoutType: t.field({ type: Task, resolve: () => plannedTask }),
  plannedBug: t.field({ type: Bug, resolve: () => plannedBug }),
  // @ts-expect-error a planned row of the base model may be another variant
  plannedTaskAsBug: t.field({ type: Bug, resolve: () => plannedTaskWithType }),
  // @ts-expect-error a planned row of a sibling variant
  plannedFeatureAsBug: t.field({ type: Bug, resolve: () => plannedFeature }),
}));

// Connection helpers made with a discriminated model's prismaInterface page it: the interface's
// selection loads the discriminator into their rows.
const tasks = prismaConnectionHelpers(inheritance, Task, {});
inheritance.prismaObjectField('User', 'taskPage', (t) =>
  t.connection({
    type: Task,
    select: { tasks: tasks.page },
    resolve: (user, args, ctx) => tasks.resolve(user.tasks, args, ctx, user),
  }),
);

// The rows of a collection from `collectionFromInfo` are planned rows of the collection's model,
// so they fit a type whose select loads a to-one relation, which the collection's own row lacks.
// A payload holds the rows as the type's `$inferType`, which a planned row fits.
const RenamePostPayload = builder
  .objectRef<{ post: typeof Authored.$inferType | null }>('RenamePostPayload')
  .implement({
    fields: (t) => ({ post: t.field({ type: Authored, nullable: true, resolve: (p) => p.post }) }),
  });
const RetitlePayload = builder
  .objectRef<{ post: typeof Titled.$inferType | null }>('RetitlePayload')
  .implement({
    fields: (t) => ({ post: t.field({ type: Titled, nullable: true, resolve: (p) => p.post }) }),
  });
builder.mutationType({
  fields: (t) => ({
    renamePostPayload: t.field({
      type: RenamePostPayload,
      resolve: async (_root, _args, context, info) => {
        const posts = await collectionFromInfo({
          collection: client.orm.Post.where({ id: 'p' }),
          context,
          info,
          path: ['post'],
        });
        return { post: await posts.update({ title: 'Renamed' }) };
      },
    }),
    retitlePayload: t.field({
      type: RetitlePayload,
      resolve: async (_root, _args, context, info) => {
        const posts = await collectionFromInfo({
          collection: client.orm.Post.where({ id: 'p' }),
          context,
          info,
          path: ['post'],
        });
        return { post: await posts.update({ title: 'Renamed' }) };
      },
    }),
    unplannedPayload: t.field({
      type: RenamePostPayload,
      // @ts-expect-error a row the ORM returns without collectionFromInfo lacks the select's `author`
      resolve: async () => ({
        post: await client.orm.Post.where({ id: 'p' }).update({ title: 'x' }),
      }),
    }),
    renamePost: t.field({
      type: Authored,
      nullable: true,
      resolve: async (_root, _args, context, info) => {
        const posts = await collectionFromInfo({
          collection: client.orm.Post.where({ id: 'p' }),
          context,
          info,
        });
        return posts.update({ title: 'Renamed' });
      },
    }),
    firstPost: t.field({
      type: Authored,
      nullable: true,
      resolve: async (_root, _args, context, info) =>
        (await collectionFromInfo({ collection: client.orm.Post, context, info })).first(),
    }),
    comment: t.field({
      type: Authored,
      nullable: true,
      resolve: async (_root, _args, context, info) =>
        // @ts-expect-error a planned row of another model
        (await collectionFromInfo({ collection: client.orm.Comment, context, info })).first(),
    }),
  }),
});

export async function plannedCollections() {
  const posts = await collectionFromInfo({ collection: client.orm.Post, context: {}, info });
  for await (const post of posts.all()) {
    expectTypeOf(post).toExtend<PlannedRowBrand<'Post'>>();
  }
  // A collection narrowed to a variant plans rows of the variant model.
  const bugs = await collectionFromInfo({
    collection: inheritanceClient.orm.Task.variant('bug'),
    context: {},
    info,
  });
  expectTypeOf((await bugs.first())!).toExtend<PlannedRowBrand<'Bug'>>();
  expectTypeOf((await bugs.first())!).not.toExtend<PlannedRowBrand<'Task'>>();
  // In a contract with several namespaces, the key names the collection's namespace.
  const namespaced = {} as PostgresClient<NamespacesContract>;
  const users = await collectionFromInfo({
    collection: namespaced.orm.nsa.User,
    context: {},
    info,
  });
  expectTypeOf((await users.first())!).toExtend<PlannedRowBrand<'nsa.User'>>();
  expectTypeOf((await users.first())!).not.toExtend<PlannedRowBrand<'nsb.User'>>();
  const crossNamespace = {} as PostgresClient<InheritanceNamespacesContract>;
  const chores = await collectionFromInfo({
    collection: crossNamespace.orm.inha.Task.variant('chore'),
    context: {},
    info,
  });
  expectTypeOf((await chores.first())!).toExtend<PlannedRowBrand<'inhb.Chore'>>();
}

// A collection typed by a type parameter keeps its methods.
export async function plannedGeneric<C extends CollectionFor<Types, 'Post'>>(collection: C) {
  const planned = await collectionFromInfo({ collection, context: {}, info });
  return planned
    .orderBy((post) => post.id.asc())
    .where({ published: 1 })
    .all();
}
