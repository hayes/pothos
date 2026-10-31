import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import { describe, expectTypeOf, it } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './fixtures/sample-contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { contract: null as never },
});

const relayBuilder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});

const withInputBuilder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [WithInputPlugin, prismaNextPlugin],
  prismaNext: { contract: null as never },
});

describe('prismaObject + select narrowing', () => {
  it('exposes exactly the keys declared in `select` (additive on top of brand)', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        id: t.exposeID('id'),
        fullName: t.string({
          select: ['firstName', 'lastName'],
          resolve: (user) => {
            expectTypeOf(user.firstName).toEqualTypeOf<string>();
            expectTypeOf(user.lastName).toEqualTypeOf<string>();
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
          // @ts-expect-error `email` is not selected
          resolve: (user) => user.email,
        }),
      }),
    });
  });

  it('rejects reading columns when no `select` is provided', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        anything: t.string({
          // @ts-expect-error no select means no columns on the parent
          resolve: (user) => user.email,
        }),
      }),
    });
  });

  it('rejects misspelled column names in select', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        typo: t.string({
          // @ts-expect-error 'frstName' is not a column on User
          select: ['firstName', 'frstName'],
          // The typo leaves no columns on the parent, so don't read any.
          resolve: () => '',
        }),
      }),
    });
  });

  it('merges object-level select into the field-level parent', () => {
    builder.prismaObject('User', {
      variant: 'UserWithEmail',
      select: { email: true },
      fields: (t) => ({
        domain: t.string({
          resolve: (user) => {
            expectTypeOf(user.email).toEqualTypeOf<string>();
            return user.email.split('@')[1] ?? '';
          },
        }),
        signature: t.string({
          select: ['firstName'],
          resolve: (user) => {
            expectTypeOf(user.email).toEqualTypeOf<string>();
            expectTypeOf(user.firstName).toEqualTypeOf<string>();
            return `${user.firstName} <${user.email}>`;
          },
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
            where: (p) => p.published.eq(1),
          },
        }),
      }),
    });
  });

  it('rejects non-existent relation names', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        // @ts-expect-error 'pets' is not a relation on User
        pets: t.relation('pets'),
      }),
    });
  });

  it('rejects accessing un-selected columns on the where-callback accessor', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relation('posts', {
          query: {
            // @ts-expect-error `nonexistent` is not a column on Post
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
        // @ts-expect-error author is not a to-many relation
        authorConn: t.relatedConnection('author', { cursor: 'id' }),
      }),
    });
  });

  it('accepts to-many relations', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        postsConn: t.relatedConnection('posts', { cursor: 'id' }),
      }),
    });
  });
});

describe('t.relationCount field helper', () => {
  it('produces a non-nullable number field', () => {
    builder.prismaObject('User', {
      variant: 'RelCountUser',
      fields: (t) => {
        const ref = t.relationCount('posts');
        expectTypeOf(ref.$inferType).toEqualTypeOf<number>();
        return { id: t.exposeID('id'), count: ref };
      },
    });
  });

  it('accepts a shorthand `where` filter and an accessor-callback `where`', () => {
    builder.prismaObject('User', {
      variant: 'RelCountWhereUser',
      fields: (t) => ({
        id: t.exposeID('id'),
        published: t.relationCount('posts', { where: { published: 1 } }),
        byFlag: t.relationCount('posts', {
          args: { flag: t.arg.int({ required: true }) },
          where: (p, args) => p.published.eq(args.flag),
        }),
      }),
    });
  });

  it('rejects an unknown relation name', () => {
    builder.prismaObject('User', {
      variant: 'RelCountBadRel',
      // @ts-expect-error `nope` is not a relation on User
      fields: (t) => ({ x: t.relationCount('nope') }),
    });
  });
});

describe('missing PrismaNextContract augmentation', () => {
  it('narrows ModelName to a sentinel when no contract is augmented', () => {
    const looseBuilder = new SchemaBuilder({
      plugins: [prismaNextPlugin],
      prismaNext: { contract: null as never },
    });
    // @ts-expect-error without PrismaNextContract, model names collapse to a sentinel
    looseBuilder.prismaObject('User', { fields: () => ({}) });
  });
});

describe('t.relatedConnection RelatedShape inference', () => {
  it('infers RelatedShape from a custom prismaObject ref passed via type', () => {
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
          // @ts-expect-error the connection args own `limit`
          limit: 5,
        }),
        brokenOrder: t.relatedConnection('posts', {
          cursor: 'id',
          // @ts-expect-error orderBy returns order items, not a column
          orderBy: (p) => p.id,
        }),
      }),
    });
  });
});

describe('t.prismaField typing — resolver shape', () => {
  it('accepts a resolver returning rows of the model shape', () => {
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

describe('t.prismaFieldWithInput typing — optional input arg', () => {
  it('types an optional input as possibly omitted as well as null', () => {
    withInputBuilder.queryType({
      fields: (t) => ({
        optionalInput: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          argOptions: { required: false },
          input: { email: t.input.string({ required: true }) },
          resolve: (_parent, args) => {
            expectTypeOf(args.input).toEqualTypeOf<{ email: string } | null | undefined>();
            return null as never;
          },
        }),
      }),
    });
  });

  it('rejects a null-only guard, which leaves the omitted case unhandled', () => {
    withInputBuilder.queryType({
      fields: (t) => ({
        nullGuardOnly: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          argOptions: { required: false },
          input: { email: t.input.string({ required: true }) },
          resolve: (_parent, args) => {
            const input = args.input;
            if (input === null) {
              return null as never;
            }
            // @ts-expect-error `input` is still possibly `undefined`
            const email: string = input.email;
            return email as never;
          },
        }),
      }),
    });
  });

  it('keeps a required input free of null and undefined', () => {
    withInputBuilder.queryType({
      fields: (t) => ({
        requiredInput: t.prismaFieldWithInput({
          type: 'User',
          nullable: true,
          input: { email: t.input.string({ required: true }) },
          resolve: (_parent, args) => {
            expectTypeOf(args.input).toEqualTypeOf<{ email: string }>();
            return null as never;
          },
        }),
      }),
    });
  });
});

describe('t.relationAggregate field helper', () => {
  it('narrows sum/avg/min/max to `number | null`', () => {
    builder.prismaObject('User', {
      variant: 'RelAggUser',
      fields: (t) => {
        const sum = t.relationAggregate('posts', { op: 'sum', field: 'published' });
        const avg = t.relationAggregate('posts', { op: 'avg', field: 'published' });
        expectTypeOf(sum.$inferType).toEqualTypeOf<number | null>();
        expectTypeOf(avg.$inferType).toEqualTypeOf<number | null>();
        return { id: t.exposeID('id'), sum, avg };
      },
    });
  });

  it('narrows count to non-nullable `number`', () => {
    builder.prismaObject('User', {
      variant: 'RelAggCountUser',
      fields: (t) => {
        const count = t.relationAggregate('posts', { op: 'count' });
        expectTypeOf(count.$inferType).toEqualTypeOf<number>();
        return { id: t.exposeID('id'), count };
      },
    });
  });

  it('requires a field for field-only aggregates', () => {
    builder.prismaObject('User', {
      variant: 'RelAggMissingField',
      fields: (t) => ({
        id: t.exposeID('id'),
        // @ts-expect-error sum requires a `field`
        broken: t.relationAggregate('posts', { op: 'sum' }),
      }),
    });
  });

  it('rejects a non-numeric column as the aggregate field', () => {
    builder.prismaObject('User', {
      variant: 'RelAggBadField',
      fields: (t) => ({
        id: t.exposeID('id'),
        broken: t.relationAggregate('posts', {
          op: 'sum',
          // @ts-expect-error `title` is not numeric
          field: 'title',
        }),
      }),
    });
  });
});

describe('function-form select — aggregate result narrowing', () => {
  it('narrows count() to `number` (non-nullable)', () => {
    builder.prismaObject('User', {
      variant: 'CountUser',
      fields: (t) => ({
        id: t.exposeID('id'),
        postCount: t.field({
          type: 'Int',
          select: { posts: (sub) => ({ posts: sub.count() }) },
          resolve: (parent) => {
            expectTypeOf(parent.posts).toEqualTypeOf<number>();
            return parent.posts;
          },
        }),
      }),
    });
  });

  it('narrows multiple count() slots in one combine', () => {
    builder.prismaObject('User', {
      variant: 'MultiCountUser',
      fields: (t) => ({
        id: t.exposeID('id'),
        postStats: t.field({
          type: 'Int',
          select: {
            posts: (sub) => ({
              total: sub.count(),
              published: sub.where((p) => p.published.eq(1)).count(),
            }),
          },
          resolve: (parent) => {
            expectTypeOf(parent.total).toEqualTypeOf<number>();
            expectTypeOf(parent.published).toEqualTypeOf<number>();
            return parent.total;
          },
        }),
      }),
    });
  });

  it('narrows sum/avg/min/max(col) to `number | null`', () => {
    builder.prismaObject('User', {
      variant: 'AvgUser',
      fields: (t) => ({
        id: t.exposeID('id'),
        // Aggregates over an empty relation are null.
        avgPost: t.field({
          type: 'Float',
          nullable: true,
          select: { posts: (sub) => ({ avg: sub.avg('published') }) },
          resolve: (parent) => {
            expectTypeOf(parent.avg).toEqualTypeOf<number | null>();
            return parent.avg;
          },
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
      // @ts-expect-error variant must be a string
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
        // @ts-expect-error the `db` option is not part of the public API
        db: null as never,
      },
    });
  });
});

describe('PreparedFieldExtension — shape', () => {
  it('preserves the model, GraphQL type and original list shape', () => {
    expectTypeOf<import('../src/extensions').PreparedFieldExtension>().toEqualTypeOf<{
      readonly modelName: string;
      readonly typeName: string;
      readonly isList: boolean;
    }>();
  });
});

describe('t.relatedConnection — resolve is stripped', () => {
  it('rejects a user-passed resolve', () => {
    builder.prismaObject('User', {
      fields: (t) => ({
        posts: t.relatedConnection('posts', {
          cursor: 'id',
          // @ts-expect-error resolve is owned by the plugin
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
          // @ts-expect-error `query` is not supported on prismaConnection
          query: () => ({ where: {} }),
          resolve: (() => null as never) as never,
        }),
      }),
    });
  });
});

describe('rebrandForVariant — public export preserves input type', () => {
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
          // @ts-expect-error edges are always non-null
          edgesNullable: true,
          resolve: (() => null as never) as never,
        }),
      }),
    });
  });
});
