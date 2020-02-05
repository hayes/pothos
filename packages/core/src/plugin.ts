import { GraphQLFieldConfig } from 'graphql';
import { BuildCacheEntry, TypeParam, FieldMap, BuildCacheEntryWithFields } from './types';
import Field from './graphql/field';
import BuildCache from './build-cache';

export default interface BasePlugin {
  visitType?(entry: BuildCacheEntry, cache: BuildCache): void;

  updateFieldConfig?(
    name: string,
    type: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    cache: BuildCache,
  ): GraphQLFieldConfig<unknown, unknown>;

  updateFields?(entry: BuildCacheEntryWithFields, fields: FieldMap, cache: BuildCache): FieldMap;
}
