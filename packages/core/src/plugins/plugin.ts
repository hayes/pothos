import { GraphQLFieldConfig, GraphQLResolveInfo, GraphQLSchema } from 'graphql';
import { BuildCacheEntry, TypeParam, MaybePromise, ImplementedType } from '../types';
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

  onFieldWrap?(
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    config: GraphQLFieldConfig<unknown, object>,
    data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
    cache: BuildCache,
  ): void;

  onType?(type: ImplementedType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>): void;

  onField?(
    type: ImplementedType,
    name: string,
    field: Field<{}, any, TypeParam<any>>,
    builder: GiraphQLSchemaTypes.SchemaBuilder<any>,
  ): void;

  beforeBuild?(builder: GiraphQLSchemaTypes.SchemaBuilder<any>): void;

  afterBuild?(schema: GraphQLSchema, builder: GiraphQLSchemaTypes.SchemaBuilder<any>): void;

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

  beforeSubscribe?(
    parent: ResolveValueWrapper,
    data: GiraphQLSchemaTypes.FieldWrapData,
    args: object,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<{
    onSubscribe?(value: unknown): MaybePromise<void>;
    onWrap?(child: ResolveValueWrapper): MaybePromise<void>;
  }>;

  onInterfaceResolveType?(
    typename: string,
    parent: ResolveValueWrapper,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<void>;

  onUnionResolveType?(
    typename: string,
    parent: ResolveValueWrapper,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<void>;
}
