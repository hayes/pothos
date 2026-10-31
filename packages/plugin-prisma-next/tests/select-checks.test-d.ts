import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './fixtures/sample-contract';
import type { Contract as PostgresContract } from './postgres/contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});
const collection = null as never;

// Type-level `select` on prismaObject / prismaInterface / prismaNode is checked against the model.
builder.prismaObject('User', {
  variant: 'SelectArray',
  select: ['firstName', 'email'],
  fields: (t) => ({
    name: t.string({
      resolve: (user) => {
        expectTypeOf(user.firstName).toEqualTypeOf<string>();
        return user.firstName;
      },
    }),
  }),
});
builder.prismaObject('User', {
  variant: 'SelectArrayTypo',
  // @ts-expect-error `firstNme` isn't a column.
  select: ['firstNme'],
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'SelectObjectTypo',
  // @ts-expect-error `firstNme` isn't a column or relation.
  select: { firstNme: true },
  fields: () => ({}),
});
builder.prismaInterface('User', {
  name: 'SelectInterfaceTypo',
  // @ts-expect-error `postz` isn't a column or relation.
  select: { postz: true },
  fields: () => ({}),
});
builder.prismaObject('User', {
  variant: 'SelectColumnShape',
  // @ts-expect-error Columns take `true`, not a refinement.
  select: { email: { limit: 1 } },
  fields: () => ({}),
});

// The function form types `sub` as the relation's refinement collection, and its keys reach rows.
builder.prismaObject('User', {
  variant: 'SelectFunction',
  select: { posts: (sub) => ({ postCount: sub.count() }) },
  fields: (t) => ({
    postCount: t.int({
      resolve: (user) => {
        expectTypeOf(user.postCount).toEqualTypeOf<number>();
        return user.postCount;
      },
    }),
  }),
});
builder.prismaInterface('User', {
  name: 'SelectInterfaceFunction',
  select: { posts: (sub) => ({ postCount: sub.count() }) },
  fields: (t) => ({ postCount: t.int({ resolve: (user) => user.postCount }) }),
});
builder.prismaObject('User', {
  variant: 'SelectFunctionBadMethod',
  // @ts-expect-error `sub` is typed, so an unknown method is rejected.
  select: { posts: (sub) => ({ n: sub.nope() }) },
  fields: () => ({}),
});

// A variable whose type is a union of the two forms keeps both.
declare const eitherSelect: readonly ['id'] | { readonly id: true };
builder.prismaObject('User', { variant: 'SelectUnion', select: eitherSelect, fields: () => ({}) });

builder.prismaNode('User', {
  variant: 'NodeSelectFunction',
  id: { field: 'id' },
  collection,
  select: { posts: (sub) => ({ postCount: sub.count() }) },
  fields: (t) => ({
    postCount: t.int({
      resolve: (user) => {
        expectTypeOf(user.postCount).toEqualTypeOf<number>();
        return user.postCount;
      },
    }),
  }),
});
builder.prismaNode('User', {
  variant: 'NodeSelectArray',
  id: { field: 'id' },
  collection,
  select: ['email'],
  fields: (t) => ({ email: t.string({ resolve: (user) => user.email }) }),
});
builder.prismaNode('User', {
  variant: 'NodeSelectTypo',
  id: { field: 'id' },
  collection,
  // @ts-expect-error `emial` isn't a column or relation.
  select: { emial: true },
  fields: () => ({}),
});
builder.prismaNode('User', {
  variant: 'NodeSelectArrayTypo',
  id: { field: 'id' },
  collection,
  // @ts-expect-error `emial` isn't a column.
  select: ['emial'],
  fields: () => ({}),
});

// A required to-one relation is not nullable when selected; a `where` can filter its row out.
builder.prismaObject('Post', {
  variant: 'RequiredToOne',
  select: { author: true },
  fields: (t) => ({
    authorName: t.string({
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'>>();
        return post.author.firstName;
      },
    }),
    fieldLevel: t.string({
      select: { author: true },
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'>>();
        return post.author.firstName;
      },
    }),
    ordered: t.string({
      select: { author: { limit: 1 } },
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'>>();
        return post.author.firstName;
      },
    }),
  }),
});
builder.prismaObject('Post', {
  variant: 'FilteredToOne',
  select: { author: true },
  fields: (t) => ({
    // The type-level include is non-null, but this field's own filtered selection replaces it.
    overridden: t.string({
      select: { author: { where: { firstName: 'Alice' } } },
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'> | null>();
        return post.author?.firstName ?? '';
      },
    }),
    filtered: t.string({
      select: { author: { where: { firstName: 'Alice' } } },
      resolve: (post) => {
        expectTypeOf(post.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'> | null>();
        return post.author?.firstName ?? '';
      },
    }),
  }),
});

// Field-level object selects reject unknown keys too.
builder.prismaObject('Post', {
  variant: 'FieldSelectChecks',
  fields: (t) => ({
    title: t.string({ select: { title: true }, resolve: (post) => post.title }),
    typo: t.string({
      // @ts-expect-error `titel` isn't a column or relation.
      select: { titel: true },
      resolve: () => '',
    }),
    arrayTypo: t.string({
      // @ts-expect-error `titel` isn't a column.
      select: ['titel'],
      resolve: () => '',
    }),
  }),
});

// relationAggregate: `field` stays required where the operation needs one, and is checked.
builder.prismaObject('User', {
  variant: 'AggregateFields',
  fields: (t) => ({
    sum: t.relationAggregate('posts', { op: 'sum', field: 'score' }),
    count: t.relationAggregate('posts', { op: 'count' }),
    countField: t.relationAggregate('posts', { op: 'count', field: 'title' }),
    // @ts-expect-error `sum` needs a field.
    missing: t.relationAggregate('posts', { op: 'sum' }),
    wrong: t.relationAggregate('posts', {
      op: 'sum',
      // @ts-expect-error `title` isn't numeric.
      field: 'title',
    }),
    unknown: t.relationAggregate('posts', {
      op: 'count',
      // @ts-expect-error `nope` isn't a column.
      field: 'nope',
    }),
  }),
});

// Cursor columns must be orderable: bytes columns have no ordering operators.
const postgresBuilder = new SchemaBuilder<{ PrismaNextContract: PostgresContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});
postgresBuilder.queryType({
  fields: (t) => ({
    temporal: t.prismaConnection({
      type: 'Entry',
      cursor: [{ field: 'createdAt', codec: 'column' }, 'id'],
      resolve: () => null as never,
    }),
    bytes: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error a bytes column can't order a cursor, even with a codec
      cursor: [{ field: 'payload', codec: 'column' }, 'id'],
      resolve: () => null as never,
    }),
  }),
});
