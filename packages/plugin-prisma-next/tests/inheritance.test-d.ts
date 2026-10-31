import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type CollectionFor, type ModelName } from '../src';
import type { RelationKeys } from '../src/types';
import type { Contract } from './inheritance/contract';

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

expectTypeOf<ModelName<Types>>().toEqualTypeOf<'Bug' | 'Feature' | 'Task' | 'User'>();

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});
const orm = null as unknown as { Task: CollectionFor<Types, 'Task'> };
const task = builder.prismaInterface('Task', {
  fields: (t) => ({
    id: t.exposeID('id'),
    // @ts-expect-error A base type doesn't have its variants' columns.
    severity: t.exposeString('severity'),
    // @ts-expect-error Unknown relations are rejected.
    nope: t.relation('nope'),
  }),
});

builder.prismaObject('Bug', {
  interfaces: [task],
  fields: (t) => ({
    // Inherited columns and relations are available without annotation.
    title: t.exposeString('title'),
    severity: t.exposeString('severity'),
    owner: t.relation('owner'),
    upper: t.string({
      resolve: (row) => {
        expectTypeOf(row).not.toBeAny();
        return 'x';
      },
    }),
    // @ts-expect-error A sibling variant's column.
    priority: t.exposeInt('priority'),
    extra: t.relation('owner', {
      // @ts-expect-error Unknown options are rejected.
      nope: true,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    bugs: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('bug') }),
    // @ts-expect-error The base collection would load every variant.
    all: t.prismaField({ type: ['Bug'], resolve: () => orm.Task }),
    // @ts-expect-error Another variant's rows.
    wrong: t.prismaField({ type: ['Bug'], resolve: () => orm.Task.variant('feature') }),
    tasks: t.prismaField({ type: ['Task'], resolve: () => orm.Task }),
    // @ts-expect-error `resolve` is required.
    noResolve: t.prismaField({ type: ['Bug'] }),
  }),
});

// A variant that declares no relations of its own has exactly its base's.
expectTypeOf<RelationKeys<Types, 'Feature'>>().toEqualTypeOf<'owner'>();
expectTypeOf<RelationKeys<Types, 'Bug'>>().toEqualTypeOf<'owner' | 'reviewer'>();
builder.prismaObject('Feature', {
  interfaces: [task],
  fields: (t) => ({
    owner: t.relation('owner'),
    // @ts-expect-error Unknown relations are rejected on a variant without its own relations.
    nope: t.relation('nope'),
    // @ts-expect-error A sibling variant's relation.
    reviewer: t.relation('reviewer'),
  }),
});
builder.prismaObject('Bug', {
  variant: 'BugRelations',
  interfaces: [task],
  fields: (t) => ({
    reviewer: t.relation('reviewer', { nullable: true }),
    // @ts-expect-error Unknown relations are rejected on a variant with its own relations.
    nope: t.relation('nope'),
  }),
});

// A variant's cursor may use its base's orderable columns.
builder.queryType({
  fields: (t) => ({
    bugPage: t.prismaConnection({
      type: 'Bug',
      cursor: ['title', 'id'],
      resolve: () => orm.Task.variant('bug'),
    }),
  }),
});

// A relation's `type` may be a variant of its target, which narrows the load.
const bugRef = builder.prismaObject('Bug', {
  variant: 'BugRef',
  interfaces: [task],
  fields: () => ({}),
});
const featureRef = builder.prismaObject('Feature', {
  variant: 'FeatureRef',
  interfaces: [task],
  fields: () => ({}),
});
const userRef = builder.prismaObject('User', { variant: 'UserRef', fields: () => ({}) });
builder.prismaObject('User', {
  variant: 'UserRelationTypes',
  fields: (t) => ({
    bugs: t.relation('tasks', { type: bugRef }),
    bugPage: t.relatedConnection('tasks', { type: bugRef, cursor: 'id' }),
    // @ts-expect-error An unrelated model's ref.
    users: t.relation('tasks', { type: userRef }),
    // @ts-expect-error `reviews` targets Bug, so its sibling Feature is rejected.
    reviews: t.relation('reviews', { type: featureRef }),
    unrelatedPage: t.relatedConnection('tasks', {
      // @ts-expect-error An unrelated model's ref.
      type: userRef,
      cursor: 'id',
    }),
  }),
});
