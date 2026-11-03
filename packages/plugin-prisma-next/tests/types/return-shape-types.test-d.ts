// A field returning a prisma type resolves to a row holding the type's key and the columns and
// to-one relations its select loads, since plugins listed before this one read the row before any
// reload.
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import prismaNextPlugin from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';

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
