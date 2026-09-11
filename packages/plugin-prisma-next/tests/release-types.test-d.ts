import SchemaBuilder from '@pothos/core';
import { expectTypeOf } from 'vitest';
import prismaNextPlugin from '../src';
import type { Contract } from './fixtures/sample-contract';

const builder = new SchemaBuilder<{
  PrismaNextContract: Contract;
  Scalars: { BigInt: { Input: bigint; Output: bigint } };
}>({ plugins: [prismaNextPlugin], prismaNext: { contract: null as never } });

builder.prismaObject('User', {
  fields: (t) => {
    const count = t.relationAggregate('posts', { op: 'count', field: 'title' });
    const nullableCount = t.relationAggregate('posts', { op: 'count', nullable: true });
    const nullableCountField = t.relationCount('posts', { nullable: true });
    const requiredSum = t.relationAggregate('posts', {
      op: 'sum',
      field: 'score',
      nullable: false,
    });
    expectTypeOf(nullableCount.$inferType).toEqualTypeOf<number | null>();
    expectTypeOf(nullableCountField.$inferType).toEqualTypeOf<number | null>();
    expectTypeOf(requiredSum.$inferType).toEqualTypeOf<number>();
    const countBigInt = t.relationAggregate('posts', { op: 'countBigInt', type: 'BigInt' });
    const sumBigInt = t.relationAggregate('posts', {
      op: 'sumBigInt',
      field: 'published',
      type: 'BigInt',
    });
    const minText = t.relationAggregate('posts', { op: 'min', field: 'title', type: 'String' });
    expectTypeOf(count.$inferType).toEqualTypeOf<number>();
    expectTypeOf(countBigInt.$inferType).toEqualTypeOf<bigint>();
    expectTypeOf(sumBigInt.$inferType).toEqualTypeOf<bigint | null>();
    expectTypeOf(minText.$inferType).toEqualTypeOf<string | null>();
    // @ts-expect-error Lossless results need a GraphQL scalar that accepts bigint.
    t.relationAggregate('posts', { op: 'countBigInt' });
    // @ts-expect-error Float cannot serialize bigint without a lossy conversion.
    t.relationAggregate('posts', { op: 'countBigInt', type: 'Float' });
    // @ts-expect-error SQLite does not declare avgDecimal.
    t.relationAggregate('posts', { op: 'avgDecimal', field: 'published', type: 'String' });
    // @ts-expect-error sumBigInt does not accept floating point fields.
    t.relationAggregate('posts', { op: 'sumBigInt', field: 'score', type: 'BigInt' });
    return { count, countBigInt, sumBigInt, minText };
  },
});

builder.queryType({
  fields: (t) => ({
    unsafeRows: t.prismaField({
      type: ['User'],
      // @ts-expect-error Raw rows cannot satisfy future nested GraphQL selections.
      resolve: () => [{ id: '1', firstName: 'a', lastName: 'b', email: 'a@b' }],
    }),
    unsafeRow: t.prismaField({
      type: 'User',
      // @ts-expect-error Root resolvers return selection-aware collections.
      resolve: () => ({ id: '1', firstName: 'a', lastName: 'b', email: 'a@b' }),
    }),
  }),
});

// A composite FK is optional if any local component is nullable.
type PostModel = Contract['domain']['namespaces']['__unbound__']['models']['Post'];
type MixedNullablePost = Omit<PostModel, 'fields' | 'relations'> & {
  fields: Omit<PostModel['fields'], 'authorId'> & {
    authorId: Omit<PostModel['fields']['authorId'], 'nullable'> & { nullable: true };
  };
  relations: Omit<PostModel['relations'], 'author'> & {
    author: Omit<PostModel['relations']['author'], 'on'> & {
      on: { localFields: readonly ['id', 'authorId']; targetFields: readonly ['id', 'email'] };
    };
  };
};
type MixedContract = Omit<Contract, 'domain'> & {
  domain: {
    namespaces: {
      __unbound__: Omit<Contract['domain']['namespaces']['__unbound__'], 'models'> & {
        models: Omit<Contract['domain']['namespaces']['__unbound__']['models'], 'Post'> & {
          Post: MixedNullablePost;
        };
      };
    };
  };
};
type MixedTypes = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: MixedContract }>;
expectTypeOf<
  import('../src/types').DefaultRelationNullable<MixedTypes, 'Post', 'author'>
>().toEqualTypeOf<true>();

builder.prismaObject('Post', {
  fields: (t) => ({
    authorName: t.string({
      select: {
        author: (author) => {
          // @ts-expect-error New aggregate reducers are unavailable on to-one refinements.
          author.countBigInt();
          // @ts-expect-error Mutation terminals cannot execute inside an include refinement.
          author.createAndCount({});
          return { rows: author.select('firstName') };
        },
      },
      resolve: () => '',
    }),
  }),
});
