import { GraphQLFieldConfig, GraphQLResolveInfo } from 'graphql';
import {
  BuildCacheEntry,
  TypeParam,
  FieldMap,
  BuildCacheEntryWithFields,
  MaybePromise,
} from '../types';
import Field from '../graphql/field';
import BuildCache from '../build-cache';
import { ResolveValueWrapper } from './resolve-wrapper';

export interface BasePlugin {
  visitType?(entry: BuildCacheEntry, cache: BuildCache): void;

  updateFieldConfig?(
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, unknown>,
    cache: BuildCache,
  ): GraphQLFieldConfig<unknown, unknown>;

  updateFields?(entry: BuildCacheEntryWithFields, fields: FieldMap, cache: BuildCache): FieldMap;

  onFieldWrap?(
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, object>,
    data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
    cache: BuildCache,
  ): void;

  beforeResolve?(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<{
    onResolve?(value: unknown): MaybePromise<void>;
    onWrap?(child: ResolveValueWrapper): MaybePromise<void>;
  }>;
}
