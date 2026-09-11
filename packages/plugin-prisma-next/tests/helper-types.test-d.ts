import type { MaybePromise } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import { expectTypeOf } from 'vitest';
import { type Apply, applySelectionToCollection, type MapperCollection } from '../src';
import type { SelectObjectSpec } from '../src/internal-types';
import type { Contract } from './fixtures/sample-contract';

declare const apply: Apply;
declare const collection: MapperCollection & { all(): Promise<unknown[]> };
declare const info: GraphQLResolveInfo;
declare const contract: Contract;

const applied = apply(collection);
expectTypeOf(applied).toEqualTypeOf<MaybePromise<typeof collection>>();
// @ts-expect-error An asynchronous selection must settle before collection execution.
applied.all();
const mapped = applySelectionToCollection(collection, info, contract, {});
expectTypeOf(mapped).toEqualTypeOf<MaybePromise<MapperCollection>>();
// @ts-expect-error The public helper cannot promise synchronous completion.
mapped.select('id');

// Public select objects use the released ORM pagination vocabulary.
type Types = PothosSchemaTypes.ExtendDefaultTypes<{ PrismaNextContract: Contract }>;
const selected: SelectObjectSpec<Types, 'User'> = { posts: { limit: 2, offset: 1 } };
expectTypeOf(selected).toMatchTypeOf<SelectObjectSpec<Types, 'User'>>();
const obsolete: SelectObjectSpec<Types, 'User'> = {
  // @ts-expect-error Pre-release take/skip options are not silently accepted.
  posts: { take: 2, skip: 1 },
};
expectTypeOf(obsolete).toMatchTypeOf<SelectObjectSpec<Types, 'User'>>();
