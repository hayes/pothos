import {
  GraphQLFieldResolver,
  GraphQLIsTypeOfFn,
  GraphQLSchema,
  GraphQLTypeResolver,
} from 'graphql';
import type { BuildCache } from '../build-cache';
import { PothosError } from '../errors';
import type {
  PothosEnumValueConfig,
  PothosInputFieldConfig,
  PothosInterfaceTypeConfig,
  PothosObjectTypeConfig,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  PothosUnionTypeConfig,
  SchemaTypes,
} from '../types';
import { createContextCache } from '../utils/context-cache';

const runCache = new WeakMap<{}, Map<unknown, unknown>>();
export class BasePlugin<Types extends SchemaTypes, T extends object = object> {
  name;

  builder;

  buildCache;

  options;

  private requestDataMap = createContextCache<T, Types['Context']>((ctx) =>
    this.createRequestData(ctx),
  );

  constructor(buildCache: BuildCache<Types>, name: keyof PothosSchemaTypes.Plugins<Types>) {
    this.name = name;
    this.builder = buildCache.builder;
    this.buildCache = buildCache;
    this.options = buildCache.options;
  }

  /**
   * Called for each type defined with the SchemaBuilder
   * @param  {PothosTypeConfig} typeConfig - Config object describing the added type
   * @return {PothosTypeConfig} Original or updated `typeConfig`
   */
  onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    return typeConfig;
  }

  /**
   * Called for each field on an Object or Interface type
   * @param  {PothosOutputFieldConfig} fieldConfig - Config object describing the added field
   * @return {PothosOutputFieldConfig} Original or updated `fieldConfig`
   */
  onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    return fieldConfig;
  }

  /**
   * Called for each argument or field on an Input object defined in your schema
   * @param  {PothosInputFieldConfig} fieldConfig - Config object describing the added field
   * @return {PothosInputFieldConfig} Original or updated `fieldConfig`
   */
  onInputFieldConfig(
    fieldConfig: PothosInputFieldConfig<Types>,
  ): PothosInputFieldConfig<Types> | null {
    return fieldConfig;
  }

  /**
   * Called for each Enum value defined in your schema
   * @param  {PothosEnumValueConfig} valueConfig - Config object describing the enum value
   * @return {PothosEnumValueConfig} Original or updated `valueConfig`
   */
  onEnumValueConfig(
    valueConfig: PothosEnumValueConfig<Types>,
  ): PothosEnumValueConfig<Types> | null {
    return valueConfig;
  }

  /**
   * Called before builder.toSchema() schema is called
   */
  beforeBuild() {}

  /**
   * Called after all fields and types have been built during `builder.toSchema()`
   * @param  {GraphQLSchema} schema - the generated schema
   * @return {PothosEnumValueConfig} Original or updated `schema`
   */
  afterBuild(schema: GraphQLSchema): GraphQLSchema {
    return schema;
  }

  /**
   * Called with the resolver for each field in the schema
   * @param  {GraphQLFieldResolver} resolve - the resolve function
   * @param  {PothosOutputFieldConfig} fieldConfig - the config object for the field associated with this resolve function
   * @return {GraphQLFieldResolver} - Either the original, or a new resolver function to use for this field
   */
  wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    return resolver;
  }

  /**
   * Called with the subscribe for each field on the Subscription type
   * @param  {GraphQLFieldResolver} subscribe - the subscribe function
   * @param  {PothosOutputFieldConfig} fieldConfig - the config object for the field associated with this subscribe function
   * @return {GraphQLFieldResolver} - Either the original, or a new subscribe function to use for this field
   */
  wrapSubscribe(
    subscribe: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    return subscribe;
  }

  /**
   * Called with the resolveType for each Interface or Union type
   * @param  {GraphQLTypeResolver} resolveType - the resolveType function
   * @param  {PothosInterfaceTypeConfig | PothosUnionTypeConfig} typeConfig - the config object for the Interface or Union type
   * @return {GraphQLTypeResolver} - Either the original, or a new resolveType function to use for this field
   */
  wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    return resolveType;
  }

  /**
   * Called with the isTypeOf for each Object type
   * @param  {GraphQLTypeResolver} resolveType - the resolveType function
   * @param  {PothosObjectTypeConfig} typeConfig - the config object for the Interface or Union type
   * @return {GraphQLTypeResolver} - Either the original, or a new resolveType function to use for this field
   */
  wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    return isTypeOf;
  }

  protected runUnique<R>(key: unknown, cb: () => R): R {
    if (!runCache.has(this.builder)) {
      runCache.set(this.builder, new Map<unknown, unknown>());
    }

    if (!runCache.get(this.builder)!.has(key)) {
      const result = cb();

      runCache.get(this.builder)!.set(key, result);

      return result;
    }

    return runCache.get(this.builder)!.get(key) as R;
  }

  /**
   * Creates a data object unique to the current request for use by this plugin
   * @param  {Types['Context']} context - the context object for the current request
   * @return {object} - The data object for the current request
   */
  protected createRequestData(context: Types['Context']): T {
    throw new PothosError('createRequestData not implemented');
  }

  /**
   * Returns a data object for the current request.  requires `createRequestData` to be implemented
   * @param  {Types['Context']} context - the context object for the current request
   * @return {object} - The data object for the current request
   */
  protected requestData(context: Types['Context']): T {
    return this.requestDataMap(context)!;
  }
}
