import {
  GraphQLFieldConfig,
  GraphQLResolveInfo,
  GraphQLSchema,
  GraphQLType,
  GraphQLNamedType,
  GraphQLInterfaceType,
  GraphQLObjectType,
} from 'graphql';
import { MaybePromise } from '../types';
import BuildCache from '../build-cache';
import { ResolveValueWrapper } from './resolve-wrapper';

export interface BasePlugin {
  visitType?(type: GraphQLNamedType, cache: BuildCache): void;

  updateFieldConfig?(
    type: GraphQLObjectType | GraphQLInterfaceType,
    name: string,
    config: GraphQLFieldConfig<unknown, object>,
    cache: BuildCache,
  ): GraphQLFieldConfig<unknown, object>;

  onFieldWrap?(
    type: GraphQLObjectType | GraphQLInterfaceType,
    name: string,
    config: GraphQLFieldConfig<unknown, object>,
    data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
    cache: BuildCache,
  ): void;

  onType?(type: GraphQLType, builder: GiraphQLSchemaTypes.SchemaBuilder<any>): void;

  onField?(
    type: GraphQLType,
    name: string,
    config: GraphQLFieldConfig<unknown, object>,
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
    type: GraphQLObjectType,
    parent: ResolveValueWrapper,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<void>;

  onUnionResolveType?(
    type: GraphQLObjectType,
    parent: ResolveValueWrapper,
    context: object,
    info: GraphQLResolveInfo,
  ): MaybePromise<void>;
}
