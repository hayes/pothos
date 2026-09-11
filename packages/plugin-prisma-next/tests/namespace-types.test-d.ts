import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import type { NamespaceId } from '@prisma/orm-framework/contract/types';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin, { prismaConnectionHelpers } from '../src';
import type { Contract } from './fixtures/sample-contract';

// Relocate every generated namespace reference, including field codec output
// metadata, so default-namespace assumptions cannot accidentally pass.
type Relocate<T> = T extends '__unbound__'
  ? T extends NamespaceId
    ? 'tenant' & NamespaceId
    : 'tenant'
  : T extends string
    ? T
    : T extends readonly unknown[]
      ? { [K in keyof T]: Relocate<T[K]> }
      : T extends (...args: never[]) => unknown
        ? T
        : T extends object
          ? { [K in keyof T as K extends '__unbound__' ? 'tenant' : K]: Relocate<T[K]> }
          : T;
type TenantContract = Relocate<Contract>;
const builder = new SchemaBuilder<{ PrismaNextContract: TenantContract }>({
  plugins: [RelayPlugin, prismaNextPlugin],
  relay: {},
  prismaNext: { contract: null as never },
});
prismaConnectionHelpers(builder, 'Post', {
  cursor: 'id',
  where: (post) => {
    post.id.eq('post-id');
    post.score.gt(1.5);
    // @ts-expect-error A namespace-scanned accessor retains numeric scalar types.
    post.score.gt('not a number');
    return post.published.eq(1);
  },
});
builder.prismaObject('User', {
  fields: (t) => ({
    posts: t.relation('posts', {
      query: {
        where: (post) => {
          post.id.eq('post-id');
          // @ts-expect-error Related-model accessors keep numeric types outside the default namespace.
          post.score.eq('not a number');
          return post.score.gt(1.5);
        },
      },
    }),
    score: t.relationAggregate('posts', { op: 'sum', field: 'score' }),
  }),
});

type TenantTypes = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: TenantContract }>;
expectTypeOf<import('../src/types').Row<TenantTypes, 'Post'>['score']>().toEqualTypeOf<number>();
