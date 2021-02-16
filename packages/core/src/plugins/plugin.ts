import { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import {
  GiraphQLEnumValueConfig,
  GiraphQLInputFieldConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  GiraphQLUnionTypeConfig,
  SchemaTypes,
} from '../types';

import { BuildCache } from '..';

const runCache = new WeakMap<{}, Set<unknown>>();
export class BasePlugin<Types extends SchemaTypes, T extends object = object> {
  name;

  builder;

  buildCache;

  options;

  private requestDataMap = new WeakMap<Types['Context'], T>();

  constructor(buildCache: BuildCache<Types>, name: keyof GiraphQLSchemaTypes.Plugins<Types>) {
    this.name = name;
    this.builder = buildCache.builder;
    this.buildCache = buildCache;
    this.options = buildCache.options;
  }

  onTypeConfig(typeConfig: GiraphQLTypeConfig): GiraphQLTypeConfig {
    return typeConfig;
  }

  onOutputFieldConfig(
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GiraphQLOutputFieldConfig<Types> {
    return fieldConfig;
  }

  onInputFieldConfig(
    fieldConfig: GiraphQLInputFieldConfig<Types>,
  ): GiraphQLInputFieldConfig<Types> {
    return fieldConfig;
  }

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>): GiraphQLEnumValueConfig<Types> {
    return valueConfig;
  }

  beforeBuild() {}

  afterBuild(schema: GraphQLSchema): GraphQLSchema {
    return schema;
  }

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return resolver;
  }

  wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    return subscribe;
  }

  wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: GiraphQLInterfaceTypeConfig | GiraphQLUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    return resolveType;
  }

  protected runUnique(key: unknown, cb: () => void) {
    if (!runCache.has(this.builder)) {
      runCache.set(this.beforeBuild, new Set());
    }

    if (!runCache.get(this.builder)!.has(key)) {
      cb();

      runCache.get(this.builder)!.add(key);
    }
  }

  protected createRequestData(context: Types['Context']): T {
    throw new Error('createRequestData not implemented');
  }

  protected requestData(context: Types['Context']): T {
    if (!this.requestDataMap.has(context)) {
      this.requestDataMap.set(context, this.createRequestData(context))!;
    }

    return this.requestDataMap.get(context)!;
  }
}
