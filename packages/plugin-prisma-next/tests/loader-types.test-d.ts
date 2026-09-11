import SchemaBuilder from '@pothos/core';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../src';
import type { SampleContract, TestRuntimeContext } from './fixtures/runtime';

declare const contract: SampleContract;
declare const orm: TestRuntimeContext['ormClient'];
type Context = { orm: typeof orm; tenantId: string };

new SchemaBuilder<{ PrismaNextContract: SampleContract; Context: Context }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    contract,
    collections: (context) => {
      expectTypeOf(context).toEqualTypeOf<Context>();
      return {
        User: context.orm.User,
        Post: context.orm.Post.where({ authorId: context.tenantId }),
      };
    },
  },
});

new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { contract, collections: { User: orm.User, Post: orm.Post } },
});

new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    contract,
    collections: {
      // @ts-expect-error A loader must return the Collection for its declared model.
      User: orm.Post,
    },
  },
});

new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [prismaNextPlugin],
  prismaNext: {
    contract,
    collections: {
      // @ts-expect-error Materialized rows cannot receive a fallback selection.
      User: [{ id: 'u-alice' }],
    },
  },
});
