import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../src';
import type { SampleContract, TestRuntimeContext } from './fixtures/runtime';

declare const ctx: TestRuntimeContext;
const builder = new SchemaBuilder<{ PrismaNextContract: SampleContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: ctx.contract },
});

builder.queryType({
  fields: (t) => ({
    ordered: t.prismaConnection({
      type: 'Post',
      cursor: ['title', 'id'],
      resolve: () => ctx.ormClient.Post.orderBy((post) => post.title.asc()),
    }),
    nullable: t.prismaConnection({
      type: 'Post',
      cursor: [
        {
          field: 'score',
          nulls: 'first',
          codec: {
            encode: (value) => {
              expectTypeOf(value).toEqualTypeOf<number>();
              return String(value);
            },
            decode: Number,
          },
        },
        'id',
      ],
      resolve: () => ctx.ormClient.Post,
    }),
  }),
});
