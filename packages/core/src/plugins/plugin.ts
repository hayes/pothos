import { GraphQLFieldResolver, GraphQLSchema, GraphQLTypeResolver } from 'graphql';
import { BuildCache } from '..';
import ConfigStore from '../config-store';
import {
  SchemaTypes,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  GiraphQLInputFieldConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLUnionTypeConfig,
  GiraphQLEnumValueConfig,
} from '../types';

export class BasePlugin<Types extends SchemaTypes, T extends object = object> {
  name: keyof GiraphQLSchemaTypes.Plugins<Types>;

  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  buildCache: BuildCache<Types>;

  configStore: ConfigStore<Types>;

  private requestDataMap = new WeakMap<Types['Context'], T>();

  constructor(buildCache: BuildCache<Types>, name: keyof GiraphQLSchemaTypes.Plugins<Types>) {
    this.name = name;
    this.builder = buildCache.builder;
    this.buildCache = buildCache;
    this.configStore = buildCache.configStore;
  }

  onTypeConfig(typeConfig: GiraphQLTypeConfig) {}

  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {}

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {}

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {}

  beforeBuild(options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {}

  afterBuild(schema: GraphQLSchema, options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {}

  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return resolver;
  }

  wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    return subscribe;
  }

  wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: GiraphQLInterfaceTypeConfig | GiraphQLUnionTypeConfig,
    buildOptions: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    return resolveType;
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
