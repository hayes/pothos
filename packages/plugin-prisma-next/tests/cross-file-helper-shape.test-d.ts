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

//
// ── Negative fixtures ───────────────────────────────────────────────────
//
// The string form of the four cross-file helpers must NOT promise
// columns nobody declared. Only `select` (object-level or field-level)
// or `t.expose*` creates a column dependency at runtime, so reading a
// column off the parent without declaring it has to be a type error —
// otherwise the first symptom is `Cannot return null for non-nullable
// field User.email` at query time.
//
// Each `@ts-expect-error` below must stay *used*: an unused-directive
// diagnostic is the regression signal if the narrowing stops applying.
//

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

// `prismaNode` shares the defect and the fix: its parent shape is
// computed from its own `select` rather than defaulted to the full row.
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

// …but `id.field` *is* a declaration. `schema-builder.ts` registers those
// columns in the ID field's own selection extensions
// (`PRISMA_NEXT_FIELD_SELECT`) before calling `id.resolve`, so the custom ID
// resolver really does receive them and must not need a redundant
// object-level `select` to read them.
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

// Every column a compound `id.field` names is declared, not just the first.
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

// The widening is scoped to what `id.field` declared — a column outside it is
// still rejected, which is the whole point of the change.
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

// `id.field` is now an inference site; it must still reject a column the model
// doesn't have.
builder.prismaNode('User', {
  variant: 'BadIdFieldNode',
  // @ts-expect-error `nope` is not a column of `User`.
  id: { field: 'nope' },
  collection: null as never,
  fields: (t) => ({ firstName: t.exposeString('firstName') }),
});

// `id.field` columns compose with an object-level `select` rather than
// replacing it.
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

//
// ── Positive fixtures ───────────────────────────────────────────────────
//
// Everything below is correct at runtime today and must keep compiling.
//

// Field-level `select` layers additively onto the brand-only base — this
// is the case the narrowing would break if `ShapeFromSelect` failed to
// compose with `ObjectBaseShape`. Array form:
builder.prismaObjectField('User', 'declaredArrayForm', (t) =>
  t.string({
    select: ['email'],
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return row.email;
    },
  }),
);

// …and object form, including relations.
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

// `t.expose*` is checked against the builder's separate `ExposableShape`
// generic, not `Shape`, so narrowing `Shape` must leave it alone.
builder.prismaObjectFields('User', (t) => ({
  exposedFirstName: t.exposeString('firstName'),
  exposedId: t.exposeID('id'),
  relatedPosts: t.relation('posts'),
}));

builder.prismaInterfaceFields('User', (t) => ({
  interfaceExposedFirstName: t.exposeString('firstName'),
}));

//
// ── The ref form is unchanged ───────────────────────────────────────────
//
// Passing a ref infers `Shape` from the ref, so it already reported the
// undeclared read before this change and must still report it — and must
// still see whatever the registered object declared.
//

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

//
// ── Escape hatch ────────────────────────────────────────────────────────
//
// `Shape` is the second positional type parameter, so anyone who really
// wants the old full-row parent can ask for it explicitly. This is the
// documented unblock for a mid-migration compile error; it opts out of
// the guarantee, so the `select` must still be declared for the read to
// work at runtime.
//

builder.prismaObjectField<'User', Row<Types, 'User'>>('User', 'escapeHatch', (t) =>
  t.string({
    select: ['email'],
    resolve: (row) => {
      expectTypeOf(row.email).toEqualTypeOf<string>();
      return row.email;
    },
  }),
);
