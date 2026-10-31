import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type CollectionFor, type ModelName } from '../../src';
import type { Contract } from '../fixtures/sample-contract';
import type { Contract as InheritanceContract } from '../inheritance/contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
const collection = null as never;

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
    resolve: (post) => `${post.authorId}:${post.id}`,
  },
  collection,
  fields: (t) => ({ title: t.exposeString('title') }),
});
const ParsedNode = builder.prismaNode('Post', {
  variant: 'ParsedNode',
  id: { field: 'id', parse: (id) => ({ id }) },
  fields: (t) => ({ title: t.exposeString('title') }),
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
      expectTypeOf(args.parsed.id).toEqualTypeOf<{ id: string }>();
      return '';
    },
  }),
);
builder.prismaNode('User', {
  variant: 'UndeclaredIdResolver',
  id: {
    field: 'id',
    // @ts-expect-error `email` is declared by neither `id.field` nor `select`
    resolve: (user) => user.email,
  },
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
expectTypeOf<ModelName<Types>>().toEqualTypeOf<'Bug' | 'Feature' | 'Task' | 'User'>();
const inheritance = new SchemaBuilder<{ PrismaNextContract: InheritanceContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { client: null as never },
});
declare const orm: { Task: CollectionFor<Types, 'Task'> };
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
    bugs: t.relation('tasks', { type: bug }),
    bugPage: t.relatedConnection('tasks', { type: bug, cursor: 'id' }),
    // @ts-expect-error an unrelated model's ref
    users: t.relation('tasks', { type: user }),
    // @ts-expect-error `reviews` targets Bug, so its sibling Feature is rejected
    reviews: t.relation('reviews', { type: feature }),
    unrelatedPage: t.relatedConnection('tasks', {
      // @ts-expect-error an unrelated model's ref
      type: user,
      cursor: 'id',
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
    tasks: t.prismaField({ type: ['Task'], resolve: () => orm.Task }),
    bugPage: t.prismaConnection({
      type: 'Bug',
      cursor: ['title', 'id'],
      resolve: () => orm.Task.variant('bug'),
    }),
  }),
});
