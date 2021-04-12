import {
  defaultFieldResolver,
  GraphQLBoolean,
  GraphQLEnumType,
  GraphQLFieldConfigArgumentMap,
  GraphQLFieldConfigMap,
  GraphQLFloat,
  GraphQLID,
  GraphQLInputFieldConfigMap,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInt,
  GraphQLInterfaceType,
  GraphQLList,
  GraphQLNamedType,
  GraphQLNonNull,
  GraphQLObjectType,
  GraphQLOutputType,
  GraphQLScalarType,
  GraphQLString,
  GraphQLTypeResolver,
  GraphQLUnionType,
} from 'graphql';
import SchemaBuilder from './builder';
import ConfigStore from './config-store';
import { MergedPlugins } from './plugins';
import BuiltinScalarRef from './refs/builtin-scalar';
import { PluginMap } from './types';
import { isThenable } from './utils';
import {
  assertNever,
  BasePlugin,
  GiraphQLEnumTypeConfig,
  GiraphQLEnumValueConfig,
  GiraphQLInputFieldConfig,
  GiraphQLInputFieldType,
  GiraphQLInputObjectTypeConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLKindToGraphQLTypeClass,
  GiraphQLMutationTypeConfig,
  GiraphQLObjectTypeConfig,
  GiraphQLOutputFieldConfig,
  GiraphQLOutputFieldType,
  GiraphQLQueryTypeConfig,
  GiraphQLScalarTypeConfig,
  GiraphQLSubscriptionTypeConfig,
  GiraphQLTypeConfig,
  GiraphQLTypeKind,
  GiraphQLUnionTypeConfig,
  ImplementableInputObjectRef,
  InputType,
  OutputType,
  SchemaTypes,
} from '.';

export default class BuildCache<Types extends SchemaTypes> {
  types = new Map<string, GraphQLNamedType>();

  builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  plugin: BasePlugin<Types>;

  options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>;

  private configStore: ConfigStore<Types>;

  private pluginMap: PluginMap<Types>;

  private pluginList: BasePlugin<Types>[];

  private implementers = new Map<string, GiraphQLObjectTypeConfig[]>();

  private typeConfigs = new Map<string, GiraphQLTypeConfig>();

  private enumValueConfigs = new Map<
    GiraphQLEnumValueConfig<Types>,
    GiraphQLEnumValueConfig<Types>
  >();

  private outputFieldConfigs = new Map<
    GiraphQLOutputFieldConfig<Types>,
    GiraphQLOutputFieldConfig<Types>
  >();

  private inputFieldConfigs = new Map<
    GiraphQLInputFieldConfig<Types>,
    GiraphQLInputFieldConfig<Types>
  >();

  constructor(
    builder: SchemaBuilder<Types>,
    options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    this.builder = builder;
    this.configStore = builder.configStore;
    this.options = options;

    const plugins: Record<string, unknown> = {};

    this.pluginList = (builder.options.plugins || []).map((pluginName) => {
      const Plugin = SchemaBuilder.plugins[pluginName!] as typeof BasePlugin;

      if (!Plugin) {
        throw new Error(`No plugin named ${pluginName} was registered`);
      }

      plugins[pluginName] = new Plugin(this, pluginName!);

      return plugins[pluginName] as BasePlugin<Types>;
    });

    this.pluginMap = plugins as PluginMap<Types>;

    this.plugin = new MergedPlugins(this, this.pluginList);
  }

  getTypeConfig<T extends GiraphQLTypeConfig['kind']>(
    ref: InputType<Types> | OutputType<Types> | string,
    kind?: T,
  ) {
    const baseConfig = this.configStore.getTypeConfig(ref, kind);

    if (!this.typeConfigs.has(baseConfig.name)) {
      this.typeConfigs.set(baseConfig.name, this.plugin.onTypeConfig(baseConfig));
    }

    const typeConfig = this.typeConfigs.get(baseConfig.name)!;

    return typeConfig as Extract<GiraphQLTypeConfig, { kind: T }>;
  }

  getInputTypeFieldConfigs(ref: InputType<Types>) {
    const typeConfig = this.getTypeConfig(ref, 'InputObject');
    const builtType = this.types.get(typeConfig.name) as GraphQLInputObjectType | undefined;

    if (!builtType) {
      throw new Error(`Input type ${typeConfig.name} has not been built yet`);
    }

    const fields = builtType.getFields();

    const fieldConfigs: Record<string, GiraphQLInputFieldConfig<Types>> = {};

    Object.keys(fields).forEach((fieldName) => {
      fieldConfigs[fieldName] = fields[fieldName].extensions!
        .giraphqlConfig as GiraphQLInputFieldConfig<Types>;
    });

    return fieldConfigs;
  }

  getImplementers(iface: GraphQLInterfaceType) {
    if (this.implementers.has(iface.name)) {
      return this.implementers.get(iface.name)!;
    }

    const implementers = [...this.configStore.typeConfigs.values()].filter(
      (type) =>
        type.kind === 'Object' &&
        type.interfaces.find((i) => this.configStore.getTypeConfig(i).name === iface.name),
    ) as GiraphQLObjectTypeConfig[];

    this.implementers.set(iface.name, implementers);

    return implementers;
  }

  buildAll() {
    this.configStore.prepareForBuild();

    this.configStore.typeConfigs.forEach((baseConfig) => {
      if (baseConfig.kind === 'Enum' || baseConfig.kind === 'Scalar') {
        this.buildTypeFromConfig(baseConfig);
      }
    });

    this.configStore.typeConfigs.forEach((baseConfig) => {
      if (baseConfig.kind === 'InputObject') {
        this.buildTypeFromConfig(baseConfig);
      }
    });

    this.types.forEach((type) => {
      if (type instanceof GraphQLInputObjectType) {
        type.getFields();
      }
    });

    this.configStore.typeConfigs.forEach((baseConfig) => {
      if (baseConfig.kind === 'Interface') {
        this.buildTypeFromConfig(baseConfig);
      }
    });

    this.configStore.typeConfigs.forEach((baseConfig) => {
      if (baseConfig.kind === 'Object') {
        this.buildTypeFromConfig(baseConfig);
      }
    });

    this.configStore.typeConfigs.forEach((baseConfig) => {
      if (baseConfig.kind === 'Union') {
        this.buildTypeFromConfig(baseConfig);
      }
    });

    this.configStore.typeConfigs.forEach((baseConfig) => {
      if (
        baseConfig.kind === 'Query' ||
        baseConfig.kind === 'Mutation' ||
        baseConfig.kind === 'Subscription'
      ) {
        this.buildTypeFromConfig(baseConfig);
      }
    });

    this.types.forEach((type) => {
      if (type instanceof GraphQLObjectType || type instanceof GraphQLInterfaceType) {
        type.getFields();
      } else if (type instanceof GraphQLUnionType) {
        type.getTypes();
      }
    });
  }

  buildTypeFromConfig(baseConfig: GiraphQLTypeConfig) {
    const config = this.getTypeConfig(baseConfig.name);

    const { name } = config;

    this.typeConfigs.set(name, config);

    switch (config.kind) {
      case 'Enum':
        this.addType(name, this.buildEnum(config));
        break;
      case 'InputObject':
        this.addType(name, this.buildInputObject(config));
        break;
      case 'Interface':
        this.addType(name, this.buildInterface(config));
        break;
      case 'Scalar':
        this.addType(name, this.buildScalar(config));
        break;
      case 'Union':
        this.addType(name, this.buildUnion(config));
        break;
      case 'Object':
      case 'Query':
      case 'Mutation':
      case 'Subscription':
        this.addType(name, this.buildObject(config));
        break;
      default:
        assertNever(config);
    }
  }

  private addType(ref: string, type: GraphQLNamedType) {
    if (this.types.has(ref)) {
      throw new Error(
        `reference or name has already been used to create another type (${type.name})`,
      );
    }

    this.types.set(ref, type);
  }

  private buildOutputTypeParam(type: GiraphQLOutputFieldType<Types>): GraphQLOutputType {
    if (type.kind === 'List') {
      if (type.nullable) {
        return new GraphQLList(this.buildOutputTypeParam(type.type));
      }

      return new GraphQLNonNull(new GraphQLList(this.buildOutputTypeParam(type.type)));
    }

    if (type.nullable) {
      return this.getOutputType(type.ref);
    }

    return new GraphQLNonNull(this.getOutputType(type.ref));
  }

  private buildInputTypeParam(type: GiraphQLInputFieldType<Types>): GraphQLInputType {
    if (type.kind === 'List') {
      if (type.required) {
        return new GraphQLNonNull(new GraphQLList(this.buildInputTypeParam(type.type)));
      }

      return new GraphQLList(this.buildInputTypeParam(type.type));
    }

    if (type.required) {
      return new GraphQLNonNull(this.getInputType(type.ref));
    }

    return this.getInputType(type.ref);
  }

  private buildFields(
    fields: Record<string, GiraphQLOutputFieldConfig<Types>>,
  ): GraphQLFieldConfigMap<unknown, object> {
    const built: GraphQLFieldConfigMap<unknown, object> = {};

    Object.keys(fields).forEach((fieldName) => {
      const originalConfig = fields[fieldName];

      if (!this.outputFieldConfigs.has(originalConfig)) {
        this.outputFieldConfigs.set(
          originalConfig,
          this.plugin.onOutputFieldConfig(originalConfig),
        );
      }

      const config = {
        ...this.outputFieldConfigs.get(originalConfig)!,
      };

      const args = this.buildInputFields(config.args);
      const argConfigs: { [name: string]: GiraphQLInputFieldConfig<Types> } = {};

      Object.keys(config.args).forEach((argName) => {
        argConfigs[argName] = this.inputFieldConfigs.get(config.args[argName])!;
      });

      config.args = argConfigs;

      built[fieldName] = {
        ...config,
        type: this.buildOutputTypeParam(config.type),
        args,
        extensions: {
          ...config.extensions,
          giraphqlOptions: config.giraphqlOptions,
          giraphqlConfig: config,
        },
        resolve: this.plugin.wrapResolve(config.resolve || defaultFieldResolver, config),
        subscribe: this.plugin.wrapSubscribe(config.subscribe, config),
      };
    });

    return built;
  }

  private buildInputFields(
    fields: Record<string, GiraphQLInputFieldConfig<Types>>,
  ): GraphQLInputFieldConfigMap {
    const built: GraphQLFieldConfigArgumentMap | GraphQLInputFieldConfigMap = {};

    Object.keys(fields).forEach((fieldName) => {
      const originalConfig = fields[fieldName];
      if (!this.inputFieldConfigs.has(originalConfig)) {
        this.inputFieldConfigs.set(originalConfig, this.plugin.onInputFieldConfig(originalConfig));
      }

      const config = this.inputFieldConfigs.get(originalConfig)!;

      built[fieldName] = {
        ...config,
        type: this.buildInputTypeParam(config.type),
        extensions: {
          ...config.extensions,
          giraphqlOptions: config.giraphqlOptions,
          giraphqlConfig: config,
        },
      };
    });

    return built;
  }

  private getInterfaceFields(type: GraphQLInterfaceType): GraphQLFieldConfigMap<unknown, object> {
    const interfaceFields = type
      .getInterfaces()
      .reduce((all, iface) => ({ ...this.getFields(iface), ...all }), {});

    const configs = this.configStore.getFields(type.name, 'Interface');

    const fields = this.buildFields(configs);

    return {
      ...interfaceFields,
      ...fields,
    };
  }

  private getObjectFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    const interfaceFields = type
      .getInterfaces()
      .reduce((all, iface) => ({ ...this.getFields(iface), ...all }), {});

    const objectFields = this.buildFields(this.configStore.getFields(type.name, 'Object'));

    return { ...interfaceFields, ...objectFields };
  }

  private getRootFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    return this.buildFields(this.configStore.getFields(type.name, 'Object'));
  }

  private getFields(type: GraphQLNamedType): GraphQLFieldConfigMap<unknown, object> {
    if (type instanceof GraphQLObjectType) {
      if (type.name === 'Query' || type.name === 'Mutation' || type.name === 'Subscription') {
        return this.getRootFields(type);
      }

      return this.getObjectFields(type);
    }

    if (type instanceof GraphQLInterfaceType) {
      return this.getInterfaceFields(type);
    }

    throw new Error(`Type ${type.name} does not have fields to resolve`);
  }

  private getInputFields(type: GraphQLInputObjectType): GraphQLInputFieldConfigMap {
    return this.buildInputFields(this.configStore.getFields(type.name, 'InputObject'));
  }

  private getType(ref: InputType<Types> | OutputType<Types> | string) {
    if (ref instanceof BuiltinScalarRef) {
      return ref.type;
    }

    const { name } = this.configStore.getTypeConfig(ref);

    const type = this.types.get(name);

    if (!type) {
      throw new TypeError(`Missing implementation of for type ${name}`);
    }

    return type;
  }

  private getOutputType(ref: OutputType<Types> | string): GraphQLOutputType {
    const type = this.getType(ref);

    if (type instanceof GraphQLInputObjectType) {
      throw new TypeError(
        `Expected ${ref} to be an output type but it was defined as an InputObject`,
      );
    }

    return type;
  }

  private getInputType(ref: InputType<Types> | string): GraphQLInputType {
    const type = this.getType(ref);

    if (!type) {
      throw new TypeError(`Missing implementation of for type ${ref}`);
    }

    if (type instanceof GraphQLObjectType) {
      throw new TypeError(
        `Expected ${ImplementableInputObjectRef} to be an input type but it was defined as a GraphQLObjectType`,
      );
    }

    if (type instanceof GraphQLInterfaceType) {
      throw new TypeError(
        `Expected ${ImplementableInputObjectRef} to be an input type but it was defined as a GraphQLInterfaceType`,
      );
    }

    if (type instanceof GraphQLUnionType) {
      throw new TypeError(
        `Expected ${ref} to be an input type but it was defined as an GraphQLUnionType`,
      );
    }

    return type;
  }

  private getTypeOfKind<T extends GiraphQLTypeKind>(
    ref: InputType<Types> | OutputType<Types> | string,
    kind: T,
  ): GiraphQLKindToGraphQLTypeClass<T> {
    const type = this.getType(ref);

    switch (kind) {
      case 'Object':
      case 'Query':
      case 'Mutation':
      case 'Subscription':
        if (type instanceof GraphQLObjectType) {
          return type as GiraphQLKindToGraphQLTypeClass<T>;
        }
        break;
      case 'Interface':
        if (type instanceof GraphQLInterfaceType) {
          return type as GiraphQLKindToGraphQLTypeClass<T>;
        }
        break;
      case 'Union':
        if (type instanceof GraphQLUnionType) {
          return type as GiraphQLKindToGraphQLTypeClass<T>;
        }
        break;
      case 'Enum':
        if (type instanceof GraphQLEnumType) {
          return type as GiraphQLKindToGraphQLTypeClass<T>;
        }
        break;
      case 'Scalar':
        if (type instanceof GraphQLScalarType) {
          return type as GiraphQLKindToGraphQLTypeClass<T>;
        }
        break;
      case 'InputObject':
        if (type instanceof GraphQLScalarType) {
          return type as GiraphQLKindToGraphQLTypeClass<T>;
        }
        break;
      default:
        break;
    }

    throw new Error(`Expected ${ref} to be of type ${kind}`);
  }

  private buildObject({
    isTypeOf,
    ...config
  }:
    | GiraphQLMutationTypeConfig
    | GiraphQLObjectTypeConfig
    | GiraphQLQueryTypeConfig
    | GiraphQLSubscriptionTypeConfig) {
    const type: GraphQLObjectType = new GraphQLObjectType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
        giraphqlConfig: config,
      },
      fields: () => this.getFields(type),
      interfaces:
        config.kind === 'Object'
          ? () =>
              (config as GiraphQLObjectTypeConfig).interfaces.map((iface) =>
                this.getTypeOfKind(iface, 'Interface'),
              )
          : undefined,
    });

    return type;
  }

  private buildInterface(config: GiraphQLInterfaceTypeConfig) {
    const resolveType: GraphQLTypeResolver<unknown, Types['Context']> = (parent, context, info) => {
      const implementers = this.getImplementers(type!);

      const promises: Promise<GiraphQLObjectTypeConfig | null>[] = [];

      for (const impl of implementers) {
        if (!impl.isTypeOf) {
          // eslint-disable-next-line no-continue
          continue;
        }

        const result = impl.isTypeOf(parent, context, info);

        if (isThenable(result)) {
          promises.push(result.then((res) => (res ? impl : null)));
        } else if (result) {
          return impl.name;
        }
      }

      if (promises.length > 0) {
        return Promise.all(promises).then((results) => results.find((result) => !!result)?.name);
      }

      return null;
    };

    const type: GraphQLInterfaceType = new GraphQLInterfaceType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
        giraphqlConfig: config,
      },
      interfaces: () => config!.interfaces.map((iface) => this.getTypeOfKind(iface, 'Interface')),
      fields: () => this.getFields(type),
      resolveType: this.plugin.wrapResolveType(resolveType, config),
    });

    return type;
  }

  private buildUnion(config: GiraphQLUnionTypeConfig) {
    const resolveType: GraphQLTypeResolver<unknown, Types['Context']> = (...args) => {
      const resultOrPromise = config.resolveType!(...args);

      const getResult = (
        result: GraphQLObjectType<unknown, object> | string | null | undefined,
      ) => {
        if (typeof result === 'string' || !result) {
          return result;
        }

        if (result instanceof GraphQLObjectType) {
          return result;
        }

        try {
          const typeConfig = this.configStore.getTypeConfig(result);

          return typeConfig.name;
        } catch (error) {
          // ignore
        }

        return result;
      };

      return isThenable(resultOrPromise)
        ? resultOrPromise.then(getResult)
        : getResult(resultOrPromise);
    };

    return new GraphQLUnionType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
        giraphqlConfig: config,
      },
      types: () => config.types.map((member) => this.getTypeOfKind(member, 'Object')),
      resolveType: this.plugin.wrapResolveType(resolveType, config),
    });
  }

  private buildInputObject(config: GiraphQLInputObjectTypeConfig) {
    const type: GraphQLInputType = new GraphQLInputObjectType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
        giraphqlConfig: config,
      },
      fields: () => this.getInputFields(type as GraphQLInputObjectType),
    });

    return type;
  }

  private buildScalar(config: GiraphQLScalarTypeConfig) {
    if (config.name === 'ID') {
      return GraphQLID;
    }

    if (config.name === 'Int') {
      return GraphQLInt;
    }

    if (config.name === 'Float') {
      return GraphQLFloat;
    }

    if (config.name === 'Boolean') {
      return GraphQLBoolean;
    }

    if (config.name === 'String') {
      return GraphQLString;
    }

    return new GraphQLScalarType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
        giraphqlConfig: config,
      },
    });
  }

  private buildEnum(config: GiraphQLEnumTypeConfig) {
    const values: Record<string, GiraphQLEnumValueConfig<Types>> = {};

    for (const key of Object.keys(config.values)) {
      const original = config.values[key] as GiraphQLEnumValueConfig<Types>;

      if (!this.enumValueConfigs.has(original)) {
        this.enumValueConfigs.set(original, this.plugin.onEnumValueConfig(original));
      }

      values[key] = this.enumValueConfigs.get(original)!;
    }

    return new GraphQLEnumType({
      ...config,
      values,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
        giraphqlConfig: config,
      },
    });
  }
}
