import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { SqliteClient } from '@prisma/orm-sqlite/runtime';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type ModelKey, prismaConnectionHelpers } from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
const collection = () => null as never;

builder.prismaNode('User', {
  variant: 'UndeclaredNode',
  id: { field: 'id' },
  collection,
  fields: (t) => ({
    // @ts-expect-error a prismaNode parent carries only declared dependencies
    undeclared: t.string({ resolve: (user) => user.email }),
  }),
});
builder.prismaNode('User', {
  variant: 'DeclaredNode',
  select: ['email'],
  id: {
    field: 'id',
    parse: (id) => id,
    resolve: (user) => {
      expectTypeOf(user.id).toEqualTypeOf<string>();
      expectTypeOf(user.email).toEqualTypeOf<string>();
      return user.id;
    },
  },
  collection,
  fields: (t) => ({ email: t.string({ resolve: (user) => user.email }) }),
});
const CompoundNode = builder.prismaNode('Post', {
  variant: 'CompoundNode',
  id: {
    field: ['authorId', 'id'],
    parse: (id) => id.split(':') as [string, string],
    resolve: (post) => `${post.authorId}:${post.id}`,
  },
  collection,
  fields: (t) => ({ title: t.exposeString('title') }),
});
const ParsedNode = builder.prismaNode('Post', {
  variant: 'ParsedNode',
  id: { field: 'id', parse: (id) => id.toLowerCase() },
  fields: (t) => ({ title: t.exposeString('title') }),
});
// `id.parse` returns the values the node is loaded by: the column's value, or a tuple.
builder.prismaNode('Post', {
  variant: 'WrongParseNode',
  // @ts-expect-error a single `id` column loads by a string, not an object
  id: { field: 'id', parse: (id) => ({ id }) },
  fields: () => ({}),
});
builder.prismaNode('Post', {
  variant: 'WrongTypeParseNode',
  // @ts-expect-error `id` is a string column
  id: { field: 'id', parse: (id) => Number(id) },
  fields: () => ({}),
});
builder.prismaNode('Post', {
  variant: 'CompoundParseNode',
  id: {
    field: ['authorId', 'id'],
    parse: (id) => [id, id],
  },
  fields: () => ({}),
});
builder.prismaNode('Post', {
  variant: 'NullableIdNode',
  // @ts-expect-error a nullable column can't identify a node
  id: { field: 'score' },
  fields: () => ({}),
});
// globalID arguments receive the node's decoded ID: column values, or what `id.parse` returns.
builder.queryField('decodedIds', (t) =>
  t.string({
    args: {
      compound: t.arg.globalID({ for: CompoundNode, required: true }),
      parsed: t.arg.globalID({ for: ParsedNode, required: true }),
    },
    resolve: (_root, args) => {
      expectTypeOf(args.compound.id).toEqualTypeOf<[string, string]>();
      expectTypeOf(args.parsed.id).toEqualTypeOf<string>();
      return '';
    },
  }),
);
builder.prismaNode('User', {
  variant: 'UndeclaredIdResolver',
  id: {
    field: 'id',
    parse: (id) => id,
    // @ts-expect-error `email` is declared by neither `id.field` nor `select`
    resolve: (user) => user.email,
  },
  collection,
  fields: () => ({}),
});
// An ID `resolve` encodes, `parse` must decode, or `node(id:)` would find no row.
builder.prismaNode('User', {
  variant: 'ResolveWithoutParse',
  // @ts-expect-error `resolve` needs `parse`
  id: { field: 'id', resolve: (user: { id: string }) => user.id },
  collection,
  fields: () => ({}),
});
// The ID takes field options, such as other plugins' and `description`.
builder.prismaNode('User', {
  variant: 'IdFieldOptions',
  id: {
    field: 'id',
    description: 'The user ID',
    deprecationReason: 'Use handle',
    extensions: { audited: true },
    resolve: undefined,
  },
  collection,
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'IdFieldOptionsAndResolve',
  id: {
    field: 'id',
    description: 'The user ID',
    parse: (id) => id,
    // An async `resolve` is allowed, as for other ID fields.
    resolve: async (user) => user.id,
  },
  collection,
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'IdFieldOwnOptions',
  // @ts-expect-error the ID's `type` is set by the node
  id: { field: 'id', type: 'String' },
  collection,
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'BadIdField',
  // @ts-expect-error `nope` isn't a column of User
  id: { field: 'nope' },
  collection,
  fields: () => ({}),
});

// Native inheritance: variants inherit their base's columns and relations, never siblings'.
type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: InheritanceContract }>;
expectTypeOf<ModelKey<Types>>().toEqualTypeOf<'Bug' | 'Feature' | 'Note' | 'Task' | 'User'>();
const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
declare const client: SqliteClient<InheritanceContract>;
const { orm } = client;
const task = inheritance.prismaInterface('Task', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // @ts-expect-error a base type doesn't have its variants' columns
    severity: t.exposeString('severity'),
    // @ts-expect-error unknown relations are rejected
    nope: t.relation('nope'),
  }),
});
const bug = inheritance.prismaObject('Bug', {
  interfaces: [task],
  fields: (t) => ({
    title: t.exposeString('title'),
    severity: t.exposeString('severity'),
    owner: t.relation('owner'),
    reviewer: t.relation('reviewer', { nullable: true }),
    // @ts-expect-error the contract makes `reviewer` nullable, so a non-null field needs `onNull`
    requiredReviewer: t.relation('reviewer', { nullable: false }),
    requiredOwner: t.relation('owner', { nullable: false }),
    // @ts-expect-error a sibling variant's column
    priority: t.exposeInt('priority'),
    // @ts-expect-error unknown relations are rejected on a variant with its own relations
    nope: t.relation('nope'),
    extra: t.relation('owner', {
      // @ts-expect-error unknown options are rejected
      nope: true,
    }),
  }),
});
const feature = inheritance.prismaObject('Feature', {
  interfaces: [task],
  fields: (t) => ({
    owner: t.relation('owner'),
    // @ts-expect-error unknown relations are rejected on a variant without its own relations
    nope: t.relation('nope'),
    // @ts-expect-error a sibling variant's relation
    reviewer: t.relation('reviewer'),
  }),
});
const user = inheritance.prismaObject('User', { variant: 'UserRef', fields: () => ({}) });
inheritance.prismaObject('User', {
  fields: (t) => ({
    // A select function's rows of a variant carry its base's columns.
    reviewTitles: t.stringList({
      select: { reviewRows: { reviews: (sub) => sub } },
      resolve: (u) => u.reviewRows.map((review) => review.title),
    }),
    bugs: t.relation('tasks', { type: bug }),
    bugPage: t.relatedConnection('tasks', { type: bug }),
    // @ts-expect-error an unrelated model's ref
    users: t.relation('tasks', { type: user }),
    // @ts-expect-error `reviews` targets Bug, so its sibling Feature is rejected
    reviews: t.relation('reviews', { type: feature }),
    unrelatedPage: t.relatedConnection('tasks', {
      // @ts-expect-error an unrelated model's ref
      type: user,
    }),
  }),
});
inheritance.queryType({
  fields: (t) => ({
    bugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('bug') }),
    // @ts-expect-error the base collection would load every variant
    all: t.prismaField({ type: ['Bug'], resolve: () => orm.Task }),
    // @ts-expect-error another variant's rows
    wrong: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('feature') }),
    // @ts-expect-error a variant's own collection isn't narrowed to its rows
    ownCollection: t.prismaField({ type: ['Bug'], resolve: () => orm.Bug }),
    tasks: t.prismaField({ type: ['Task'], resolve: () => orm.Task }),
    // A base type takes a collection narrowed to one of its variants.
    bugsAsTasks: t.prismaField({ type: ['Task'], resolve: () => orm.Task.variant('bug') }),
    bugPage: t.prismaConnection({
      type: 'Bug',
      query: { orderBy: { title: 'asc' } },
      resolve: () => orm.Task.variant('bug'),
    }),
    bugPageFromOwn: t.prismaConnection({
      type: 'Bug',
      // @ts-expect-error a variant's own collection isn't narrowed to its rows
      resolve: () => orm.Bug,
    }),
    bugPageFromBase: t.prismaConnection({
      type: 'Bug',
      // @ts-expect-error the base collection would load every variant
      resolve: () => orm.Task,
    }),
    bugPageFromSibling: t.prismaConnection({
      type: 'Bug',
      // @ts-expect-error another variant's rows
      resolve: () => orm.Task.variant('feature'),
    }),
    // The interface routes a row by its discriminator before any field runs, so a plain field
    // returning it needs `type` beside the key.
    taskByKey: t.field({ type: task, resolve: () => ({ id: 't1', type: 'bug' as const }) }),
    // @ts-expect-error a key-only row has no discriminator to route by
    taskWithoutType: t.field({ type: task, resolve: () => ({ id: 't1' }) }),
    // A variant's own type needs no discriminator.
    bugByKey: t.field({ type: bug, resolve: () => ({ id: 't1' }) }),
  }),
});

// `collection` and `applyPagination` take the same collections as `resolve`.
inheritance.prismaNode('Bug', {
  variant: 'NarrowedBugNode',
  id: { field: 'id' },
  collection: () => orm.Task.variant('bug'),
  fields: () => ({}),
});
inheritance.prismaNode('Bug', {
  variant: 'OwnCollectionBugNode',
  id: { field: 'id' },
  // @ts-expect-error a variant's own collection isn't narrowed to its rows
  collection: () => orm.Bug,
  fields: () => ({}),
});
inheritance.prismaNode('Bug', {
  variant: 'BaseCollectionBugNode',
  id: { field: 'id' },
  // @ts-expect-error the base collection would load every variant
  collection: () => orm.Task,
  fields: () => ({}),
});
inheritance.prismaNode('Bug', {
  variant: 'SiblingCollectionBugNode',
  id: { field: 'id' },
  // @ts-expect-error another variant's rows
  collection: () => orm.Task.variant('feature'),
  fields: () => ({}),
});
const bugHelpers = prismaConnectionHelpers(inheritance, bug, {});
bugHelpers.applyPagination(orm.Task.variant('bug'), {}, {});
// @ts-expect-error a variant's own collection isn't narrowed to its rows
bugHelpers.applyPagination(orm.Bug, {}, {});
// @ts-expect-error the base collection would load every variant
bugHelpers.applyPagination(orm.Task, {}, {});
// @ts-expect-error another variant's rows
bugHelpers.applyPagination(orm.Task.variant('feature'), {}, {});

// `collection` receives the builder's context type.
const withContext = new SchemaBuilder<{
  Context: { viewerId: string };
  PrismaNextContract: InheritanceContract;
}>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client },
});
withContext.prismaNode('Bug', {
  id: { field: 'id' },
  collection: (ctx) => {
    expectTypeOf(ctx).toEqualTypeOf<{ viewerId: string }>();
    return client.orm.Task.variant('bug');
  },
  fields: () => ({}),
});
