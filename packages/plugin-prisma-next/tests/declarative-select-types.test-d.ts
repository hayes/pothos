import SchemaBuilder from '@pothos/core';
import type { DefaultModelRow } from '@prisma/orm-family-sql/orm-client';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './fixtures/sample-contract';

const builder = new SchemaBuilder<{ PrismaNextContract: Contract }>({
  plugins: [prismaNextPlugin],
  prismaNext: { contract: null as never },
});

builder.prismaObject('Post', {
  select: { author: { where: { firstName: 'Alice' } } },
  fields: (t) => ({
    name: t.string({
      resolve: (row) => {
        expectTypeOf(row.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'> | null>();
        return row.author?.firstName ?? '';
      },
    }),
  }),
});
builder.prismaObject('User', {
  select: { posts: { limit: 2 } },
  fields: (t) => ({
    titles: t.string({
      resolve: (row) => {
        expectTypeOf(row.posts).toEqualTypeOf<readonly DefaultModelRow<Contract, 'Post'>[]>();
        return row.posts.map((post) => post.title).join(',');
      },
    }),
  }),
});
builder.prismaObject('Post', {
  name: 'FieldPost',
  fields: (t) => ({
    name: t.string({
      select: { author: { where: { firstName: 'Alice' } } },
      resolve: (row) => {
        expectTypeOf(row.author).toEqualTypeOf<DefaultModelRow<Contract, 'User'> | null>();
        return row.author?.firstName ?? '';
      },
    }),
  }),
});
builder.prismaObject('User', {
  name: 'FieldUser',
  fields: (t) => ({
    titles: t.string({
      select: { posts: { limit: 2 } },
      resolve: (row) => {
        expectTypeOf(row.posts).toEqualTypeOf<readonly DefaultModelRow<Contract, 'Post'>[]>();
        return row.posts.map((post) => post.title).join(',');
      },
    }),
  }),
});
