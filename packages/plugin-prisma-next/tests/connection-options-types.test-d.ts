import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../src';
import type { SampleContract, TestRuntimeContext } from './fixtures/runtime';
import type { Contract as PostgresContract } from './postgres/contract';

declare const ctx: TestRuntimeContext;
declare const postgresContract: PostgresContract;
declare const client: import('@prisma/orm-postgres/runtime').PostgresClient<PostgresContract>;

const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: ctx.contract },
});

// A client's context is accepted as it is.
const postgres = new SchemaBuilder<{ PrismaNextContract: PostgresContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: postgresContract, context: client.context },
});

new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: {
    contract: ctx.contract,
    // @ts-expect-error A client's context holds contractCodecs.
    context: {},
  },
});

postgres.queryType({
  fields: (t) => ({
    column: t.prismaConnection({
      type: 'Entry',
      cursor: [{ field: 'createdAt', codec: 'column' }, 'id'],
      resolve: () => client.orm.public.Entry,
    }),
    explicit: t.prismaConnection({
      type: 'Entry',
      cursor: [
        {
          field: 'createdAt',
          codec: {
            encode: (value) => value.toZonedDateTimeISO('UTC').toString(),
            decode: (value) => globalThis.Temporal.Instant.from(value),
          },
        },
        'id',
      ],
      resolve: () => client.orm.public.Entry,
    }),
    bare: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error A Temporal column needs a codec, so it can't be named bare.
      cursor: ['createdAt', 'id'],
      resolve: () => client.orm.public.Entry,
    }),
    missingCodec: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error The codec property is required for a Temporal column.
      cursor: [{ field: 'createdAt' }, 'id'],
      resolve: () => client.orm.public.Entry,
    }),
    wrongCodec: t.prismaConnection({
      type: 'Entry',
      // @ts-expect-error Only 'column' names a built-in codec.
      cursor: [{ field: 'createdAt', codec: 'columns' }, 'id'],
      resolve: () => client.orm.public.Entry,
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    inferred: t.prismaConnection({
      type: 'Post',
      cursor: ['title', 'id'],
      args: { newest: t.arg.boolean() },
      orderBy: (post, args, context) => {
        expectTypeOf(args.newest).toEqualTypeOf<boolean | null | undefined>();
        expectTypeOf(context).not.toBeAny();
        return args.newest ? post.title.desc() : post.title.asc();
      },
      resolve: () => ctx.ormClient.Post,
    }),
    list: t.prismaConnection({
      type: 'Post',
      cursor: ['title', 'id'],
      orderBy: (post) => [post.title.desc(), post.id.asc()],
      resolve: () => ctx.ormClient.Post,
    }),
    unknownColumn: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      // @ts-expect-error `nope` is not a Post column.
      orderBy: (post) => post.nope.asc(),
      resolve: () => ctx.ormClient.Post,
    }),
    notAnItem: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      // @ts-expect-error orderBy returns order items.
      orderBy: (post) => post.id,
      resolve: () => ctx.ormClient.Post,
    }),
    excess: t.prismaConnection({
      type: 'Post',
      cursor: 'id',
      // @ts-expect-error Unknown option.
      orderByy: () => [],
      resolve: () => ctx.ormClient.Post,
    }),
    // @ts-expect-error `cursor` is required.
    missing: t.prismaConnection({ type: 'Post', resolve: () => ctx.ormClient.Post }),
  }),
});

builder.prismaObject('User', {
  fields: (t) => ({
    related: t.relatedConnection('posts', {
      cursor: ['title', 'id'],
      args: { newest: t.arg.boolean() },
      orderBy: (post, args) => {
        expectTypeOf(args.newest).toEqualTypeOf<boolean | null | undefined>();
        return post.title.desc();
      },
    }),
    relatedExcess: t.relatedConnection('posts', {
      cursor: 'id',
      // @ts-expect-error Unknown option.
      orderByy: () => [],
    }),
  }),
});
