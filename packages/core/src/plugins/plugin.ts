import {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLType,
  GraphQLField,
  GraphQLNamedType,
} from 'graphql';
import { MaybePromise } from '../types';
import BuildCache from '../build-cache';
import { ResolveValueWrapper } from './resolve-wrapper';

export interface BasePlugin {
  visitType?(type: GraphQLNamedType, cache: BuildCache): void;

  updateFieldConfig?(
    name: string,
    config: GraphQLFieldConfig<unknown, unknown>,
    cache: BuildCache,
  ): GraphQLFieldConfig<unknown, unknown>;

  onFieldWrap?(
    name: string,
    field: GraphQLField<unknown, object>,
    data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
    cache: BuildCache,
  ): void;

  onType?(type: GraphQLType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>): void;

  onField?(
    type: GraphQLType,
    name: string,
    field: GraphQLFieldConfig<unknown, object>,
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
    onWrap?(
      child: ResolveValueWrapper,
      index: number | null,
      wrap: (child: unknown) => MaybePromise<ResolveValueWrapper>,
    ): MaybePromise<void>;
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
