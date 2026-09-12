import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { type Row } from '../src';
import type { Contract } from './fixtures/sample-contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});

type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;

builder.prismaObjectField('User', 'undeclaredViaObjectField', (t) =>
  t.string({
    // @ts-expect-error The string form's parent carries only declared dependencies.
    resolve: (row) => row.email,
  }),
);

builder.prismaObjectFields('User', (t) => ({
  undeclaredViaObjectFields: t.string({
    // @ts-expect-error The string form's parent carries only declared dependencies.
    resolve: (row) => row.email,
  }),
}));

builder.prismaInterfaceField('User', 'undeclaredViaInterfaceField', (t) =>
  t.string({
    // @ts-expect-error The string form's parent carries only declared dependencies.
    resolve: (row) => row.email,
  }),
);

builder.prismaInterfaceFields('User', (t) => ({
  undeclaredViaInterfaceFields: t.string({
    // @ts-expect-error The string form's parent carries only declared dependencies.
    resolve: (row) => row.email,
  }),
}));

builder.prismaNode('User', {
  variant: 'UndeclaredNode',
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({
    undeclared: t.string({
      // @ts-expect-error `prismaNode`'s parent carries only declared dependencies.
      resolve: (row) => row.email,
    }),
  }),
});

builder.prismaNode('User', {
  variant: 'CustomIdResolverNode',
  id: {
    field: 'id',
    resolve: (row) => {
      expectTypeOf(row.id).toEqualTypeOf<string>();
      return row.id;
    },
  },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('Post', {
  variant: 'CompoundIdResolverNode',
  id: {
    field: ['authorId', 'id'],
    resolve: (row) => {
      expectTypeOf(row.authorId).toEqualTypeOf<string>();
      expectTypeOf(row.id).toEqualTypeOf<string>();
      return `${row.authorId}:${row.id}`;
    },
  },
  collection: null as never,
  fields: (t) => ({ title: t.exposeString('title') }),
});

builder.prismaNode('User', {
  variant: 'CustomIdResolverUndeclaredNode',
  id: {
    field: 'id',
    // @ts-expect-error `email` is declared by neither `id.field` nor `select`.
    resolve: (row) => row.email,
  },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'BadIdFieldNode',
  // @ts-expect-error `nope` is not a column of `User`.
  id: { field: 'nope' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'CustomIdResolverSelectNode',
  select: ['email'],
  id: {
    field: 'id',
    resolve: (row) => {
      expectTypeOf(row.id).toEqualTypeOf<string>();
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return `${row.id}:${row.email}`;
    },
  },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'TypoArraySelectNode',
  // @ts-expect-error `emial` is not a column of `User`.
  select: ['emial'],
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'TypoObjectSelectNode',
  // @ts-expect-error `nosuchcolumn` is not a column of `User`.
  select: { nosuchcolumn: true },
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'TypoRelationSelectNode',
  // @ts-expect-error `psots` is not a relation of `User`.
  select: { psots: { limit: 3 } },
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'MixedTypoObjectSelectNode',
  // @ts-expect-error `emial` is not a column of `User`, even beside a valid key.
  select: { email: true, emial: true },
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'MixedTypoRelationSelectNode',
  // @ts-expect-error `psots` is not a relation of `User`, even beside a valid key.
  select: { posts: true, psots: { limit: 3 } },
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaNode('User', {
  variant: 'MixedTypoArraySelectNode',
  // @ts-expect-error `emial` is not a column of `User`, even beside a valid one.
  select: ['email', 'emial'],
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

builder.prismaObjectField('User', 'declaredArrayForm', (t) =>
  t.string({
    select: ['email'],
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return row.email;
    },
  }),
);

builder.prismaObjectFields('User', (t) => ({
  declaredObjectForm: t.string({
    select: { email: true, posts: true },
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      expectTypeOf(row.posts).toEqualTypeOf<readonly DefaultModelRow<Contract, 'Post'>[]>();
      return `${row.email}:${row.posts.length}`;
    },
  }),
}));

builder.prismaInterfaceField('User', 'declaredOnInterfaceField', (t) =>
  t.string({
    select: ['email'],
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return row.email;
    },
  }),
);

builder.prismaInterfaceFields('User', (t) => ({
  declaredOnInterfaceFields: t.string({
    select: ['lastName'],
    resolve: (row) => {
      expectTypeOf(row.lastName).toEqualTypeOf<string>();
      return row.lastName;
    },
  }),
}));

builder.prismaNode('User', {
  variant: 'DeclaredNode',
  select: ['email'],
  id: { field: 'id' },
  collection: null as never,
  fields: (t) => ({
    declared: t.string({
      resolve: (row) => {
        expectTypeOf(row.email).toEqualTypeOf<string>();
        return row.email;
      },
    }),
  }),
});

builder.prismaObjectFields('User', (t) => ({
  exposedFirstName: t.exposeString('firstName'),
  exposedId: t.exposeID('id'),
  relatedPosts: t.relation('posts'),
}));

builder.prismaInterfaceFields('User', (t) => ({
  interfaceExposedFirstName: t.exposeString('firstName'),
}));

const bareUserRef = builder.prismaObject('User', {
  variant: 'BareRefUser',
  fields: (t) => ({ id: t.exposeID('id') }),
});

builder.prismaObjectField(bareUserRef, 'undeclaredViaRef', (t) =>
  t.string({
    // @ts-expect-error The ref's shape carries only what the object declared.
    resolve: (row) => row.email,
  }),
);

const selectedUserRef = builder.prismaObject('User', {
  variant: 'SelectedRefUser',
  select: ['email'],
  fields: (t) => ({ id: t.exposeID('id') }),
});

builder.prismaObjectFields(selectedUserRef, (t) => ({
  declaredViaRef: t.string({
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return row.email;
    },
  }),
}));

builder.prismaObjectField<'User', Row<Types, 'User'>>('User', 'escapeHatch', (t) =>
  t.string({
    select: ['email'],
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return row.email;
    },
  }),
);
