import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { describe, expectTypeOf, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './fixtures/sample-contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  // Runtime args don't matter here — these tests never call .toSchema().
  prismaNext: { contract: null as never },
});

const relayBuilder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});

describe('prismaObject + select narrowing', () => {
  it('narrows the resolver parent shape to the keys declared in `select`', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        fullName: t.string({
          select: ['firstName', 'lastName'],
          resolve: (user) => {
            // user is narrowed to { firstName, lastName } only.
            expectTypeOf(user).toEqualTypeOf<{ firstName: string; lastName: string }>();
            return `${user.firstName} ${user.lastName}`;
          },
        }),
      }),
    });
  });

  it('rejects accessing un-selected columns', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        leakyEmail: t.string({
          select: ['firstName'],
          // @ts-expect-error — `email` was not in select, narrowed parent rejects it
          resolve: (user) => user.email,
        }),
      }),
    });
  });

  it('keeps the full row when no `select` is provided', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        anything: t.string({
          resolve: (user) => {
            // Without select, user is the full row — email is reachable.
            return user.email;
          },
        }),
      }),
    });
  });

  it('rejects misspelled column names in select', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        typo: t.string({
          // @ts-expect-error — 'frstName' is not a column on User
          select: ['firstName', 'frstName'],
          resolve: (user) => user.firstName,
        }),
      }),
    });
  });
});

describe('t.relation typing', () => {
  it('autocompletes relation names and narrows the where-callback accessor', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          query: {
            // `p` is typed against Post — `published` is a Post column.
            where: (p) => p.published.eq(1),
          },
        }),
      }),
    });
  });

  it('rejects non-existent relation names', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        // @ts-expect-error — 'pets' is not a relation on User
        pets: t.relation('pets'),
      }),
    });
  });

  it('rejects accessing un-selected columns on the where-callback accessor', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          query: {
            // @ts-expect-error — `nonexistent` is not a column on Post
            where: (p) => p.nonexistent.eq(1),
          },
        }),
      }),
    });
  });
});

describe('t.relatedConnection — type-level constraints', () => {
  it('rejects to-one relations', () => {
    builder.prismaObject('Post', {
      fields: (t) => ({
        // `author` is N:1 (to-one) — relatedConnection requires to-many.
        // @ts-expect-error — author is not a to-many relation
        authorConn: t.relatedConnection('author', { cursor: 'id' }),
      }),
    });
  });

  it('accepts to-many relations', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        // posts is 1:N (to-many) — should compile cleanly.
        postsConn: t.relatedConnection('posts', { cursor: 'id' }),
      }),
    });
  });
});

describe('t.relationCount — type-level constraints', () => {
  it('rejects to-one relations', () => {
    builder.prismaObject('Post', {
      fields: (t) => ({
        // `author` is N:1 — relationCount only makes sense on to-many.
        // @ts-expect-error — author is not a to-many relation
        authorCount: t.relationCount('author'),
      }),
    });
  });

  it('accepts to-many relations', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        postCount: t.relationCount('posts'),
      }),
    });
  });
});

describe('missing PrismaNextContract augmentation (D7)', () => {
  it('narrows ModelName to a sentinel when no contract is augmented', () => {
    // Builder without `PrismaNextContract` in SchemaTypes — falls back
    // to the default `AnyContract`, so the model-name union collapses
    // to a sentinel literal that surfaces in IDE autocomplete.
    const looseBuilder = new SchemaBuilder({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: null as never },
    });
    // @ts-expect-error — 'User' isn't assignable to the sentinel string;
    // the error mentions setting PrismaNextContract on SchemaTypes.
    looseBuilder.prismaObject('User', { fields: () => ({}) });
  });
});

describe('t.relatedConnection RelatedShape inference', () => {
  it('infers RelatedShape from a custom prismaObject ref passed via type', () => {
    // A second prismaObject for Post under a different GraphQL type.
    // The ref carries a custom Shape that t.relatedConnection.type
    // should propagate to nested type inference (e.g. resolver shape).
    const postSummaryRef = relayBuilder.prismaObject('Post', {
      name: 'PostSummary',
      fields: (t) => ({
        title: t.exposeString('title'),
      }),
    });
    relayBuilder.prismaObject('User', {
      name: 'UserWithCustomConnection',
      fields: (t) => ({
        id: t.exposeID('id'),
        posts: t.relatedConnection('posts', {
          cursor: 'id',
          type: postSummaryRef,
        }),
      }),
    });
    // No runtime assertion — successful compile is the test.
    expectTypeOf(postSummaryRef).toMatchTypeOf<object>();
  });
});

describe('t.relatedConnection where option — filter-only at the type level', () => {
  it('accepts a literal shorthand `where`', () => {
    relayBuilder.prismaObject('User', {
      fields: (t) => ({
        published: t.relatedConnection('posts', {
          cursor: 'id',
          where: { published: 1 },
        }),
      }),
    });
  });

  it('accepts an accessor-callback `where` (args + ctx in scope)', () => {
    relayBuilder.prismaObject('User', {
      fields: (t) => ({
        ownedByMe: t.relatedConnection('posts', {
          cursor: 'id',
          where: (p, _args, _ctx) => p.authorId.eq('me'),
        }),
      }),
    });
  });

  it('rejects orderBy / take / skip on the option (cursor-owned)', () => {
    relayBuilder.prismaObject('User', {
      fields: (t) => ({
        broken: t.relatedConnection('posts', {
          cursor: 'id',
          // @ts-expect-error — take owned by cursor, not on the option
          take: 5,
        }),
        brokenOrder: t.relatedConnection('posts', {
          cursor: 'id',
          // @ts-expect-error — orderBy owned by cursor, not on the option
          orderBy: (p) => p.id.asc(),
        }),
      }),
    });
  });
});

describe('t.prismaField typing — first-arg shape', () => {
  it('accepts an async resolver that returns rows of the model shape', () => {
    // Type-level smoke: the resolver signature compiles with the
    // model-row return shape. The first-arg name in the source type
    // is `collection` (carryover from the pre-apply API). The runtime
    // injects the identity-typed `apply: <C>(c: C) => C` wrapper, so
    // tests use `as never` casts on the resolver body to bridge the
    // source-typing gap. See `Apply` in `src/utils/apply.ts`.
    builder.queryType({
      fields: (t) => ({
        users: t.prismaField({
          type: ['User'],
          resolve: (() => [] as never) as never,
        }),
      }),
    });
  });
});

describe('t.relationAggregate — IncludeScalar return narrow', () => {
  it('accepts a count() / sum() / avg() / min() / max() return', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        postCount: t.relationAggregate('posts', {
          type: 'Int',
          aggregate: (rel) => rel.count(),
        }),
      }),
    });
  });

  it('rejects a naked Collection return', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        broken: t.relationAggregate('posts', {
          type: 'Int',
          // @ts-expect-error — must return an IncludeScalar, not a Collection
          aggregate: (rel) => rel,
        }),
      }),
    });
  });

  it('rejects a Collection.where(...) return without an aggregate finisher', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        broken: t.relationAggregate('posts', {
          type: 'Int',
          // @ts-expect-error — `.where(...)` returns a Collection, not an IncludeScalar
          aggregate: (rel) => rel.where((p) => p.published.eq(1)),
        }),
      }),
    });
  });
});

describe('prismaObject — variant typing', () => {
  it('accepts a string variant', () => {
    builder.prismaObject('User', {
      variant: 'AdminUser',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
  });

  it('rejects a non-string variant', () => {
    builder.prismaObject('User', {
      // @ts-expect-error — variant must be a string
      variant: 42,
      fields: (t) => ({ id: t.exposeID('id') }),
    });
  });
});

describe('prismaInterface — variant typing', () => {
  it('accepts { variant }', () => {
    builder.prismaInterface('User', {
      variant: 'UserBase',
      fields: (t) => ({ id: t.exposeID('id') }),
    });
  });
});

describe('builder option — db option is gone', () => {
  it('rejects passing a `db` field on the prismaNext option', () => {
    new SchemaBuilder<{ PrismaNextContract: Contract; Context: { tenant: string } }>({
      plugins: [prismaNextPlugin],
      prismaNext: {
        contract: null as never,
        // @ts-expect-error — the `db` option was removed from the public API.
        db: null as never,
      },
    });
  });
});

describe('PreparedFieldExtension — shape', () => {
  it('has { modelName, typeName } both as string', () => {
    expectTypeOf<import('../src/extensions').PreparedFieldExtension>().toEqualTypeOf<{
      readonly modelName: string;
      readonly typeName: string;
    }>();
  });
});

describe('t.relatedConnection — resolve is stripped', () => {
  it('rejects a user-passed resolve', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relatedConnection('posts', {
          cursor: 'id',
          // @ts-expect-error — resolve is owned by the plugin; user resolve would be dropped silently
          resolve: () => [],
        }),
      }),
    });
  });
});

describe('t.prismaConnection — `query` sentinel rejects plugin-prisma porting attempts', () => {
  it('rejects passing a query object (plugin-prisma shape)', () => {
    relayBuilder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          // @ts-expect-error — `query` is a typed sentinel for plugin-prisma porters
          query: () => ({ where: {} }),
          resolve: (() => null as never) as never,
        }),
      }),
    });
  });
});

describe('brandResult / rebrandForVariant — public exports preserve input type', () => {
  it('brandResult is generic — passing a typed value returns the same type', async () => {
    const { brandResult } = await import('../src');
    type Row = { id: string; name: string };
    const arr: readonly Row[] = [{ id: '1', name: 'a' }];
    // Compile-time: branded shouldn't widen to unknown.
    expectTypeOf(brandResult(arr, 'User')).toEqualTypeOf<readonly Row[]>();
    // A Promise<T> passes through too.
    const p: Promise<Row> = Promise.resolve({ id: '1', name: 'a' });
    expectTypeOf(brandResult(p, 'User')).toEqualTypeOf<Promise<Row>>();
  });

  it('rebrandForVariant preserves the input shape', async () => {
    const { rebrandForVariant } = await import('../src');
    type Row = { id: string };
    const r: Row = { id: '1' };
    expectTypeOf(rebrandForVariant(r, 'AdminUser')).toEqualTypeOf<Row>();
  });
});

describe('PrismaNextConnectionFieldOptions — edgesNullable pinned to false', () => {
  it('rejects edgesNullable: true', () => {
    relayBuilder.queryType({
      fields: (t) => ({
        users: t.prismaConnection({
          type: 'User',
          cursor: 'id',
          // @ts-expect-error — generic pinned to false; matches sister plugins
          edgesNullable: true,
          resolve: (() => null as never) as never,
        }),
      }),
    });
  });
});
