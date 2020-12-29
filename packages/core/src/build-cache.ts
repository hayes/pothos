import {
  GraphQLNamedType,
  GraphQLEnumType,
  GraphQLInterfaceType,
  GraphQLObjectType,
  GraphQLScalarType,
  GraphQLUnionType,
  GraphQLFieldConfigMap,
  GraphQLOutputType,
  GraphQLInputObjectType,
  GraphQLInputType,
  GraphQLInputFieldConfigMap,
  GraphQLFieldConfigArgumentMap,
  GraphQLNonNull,
  GraphQLList,
  GraphQLID,
  GraphQLBoolean,
  GraphQLString,
  GraphQLFloat,
  GraphQLInt,
} from 'graphql';
import {
  BasePlugin,
  assertNever,
  GiraphQLObjectTypeConfig,
  GiraphQLQueryTypeConfig,
  GiraphQLSubscriptionTypeConfig,
  GiraphQLMutationTypeConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLUnionTypeConfig,
  GiraphQLInputObjectTypeConfig,
  GiraphQLScalarTypeConfig,
  GiraphQLEnumTypeConfig,
  GiraphQLKindToGraphQLTypeClass,
  GiraphQLTypeKind,
  OutputType,
  SchemaTypes,
  InputType,
  ImplementableInputObjectRef,
  GiraphQLOutputFieldConfig,
  GiraphQLInputFieldConfig,
  GiraphQLInputFieldType,
  GiraphQLOutputFieldType,
} from '.';
import ConfigStore from './config-store';
import { wrapResolveType, wrapResolver, wrapSubscriber } from './plugins/wrap-field';
import { mergeFieldWrappers } from './plugins/merge-field-wrappers';

export default class BuildCache<Types extends SchemaTypes> {
  types = new Map<string, GraphQLNamedType>();

  private configStore: ConfigStore<Types>;

  private plugin: Required<BasePlugin<Types>>;

  private options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>;

  private implementers = new Map<string, GiraphQLObjectTypeConfig[]>();

  constructor(
    configStore: ConfigStore<any>,
    plugin: Required<BasePlugin<Types>>,
    options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>,
  ) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    this.configStore = configStore;
    this.plugin = plugin;
    this.options = options;
  }

  getType(ref: string | OutputType<Types> | InputType<Types>) {
    const { name } = this.configStore.getTypeConfig(ref);

    const type = this.types.get(name);

    if (!type) {
      throw new TypeError(`Missing implementation of for type ${name}`);
    }

    return type;
  }

  getOutputType(ref: string | OutputType<Types>): GraphQLOutputType {
    const type = this.getType(ref);

    if (type instanceof GraphQLInputObjectType) {
      throw new TypeError(
        `Expected ${ref} to be an output type but it was defined as an InputObject`,
      );
    }

    return type;
  }

  getInputType(ref: string | InputType<Types>): GraphQLInputType {
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

  getTypeOfKind<T extends GiraphQLTypeKind>(
    ref: string | OutputType<Types> | InputType<Types>,
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
    this.configStore.typeConfigs.forEach((config) => {
      const { name } = config;

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
    });
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
    type: GraphQLObjectType | GraphQLInterfaceType,
    fields: Record<string, GiraphQLOutputFieldConfig<Types>>,
  ): GraphQLFieldConfigMap<unknown, object> {
    const built: GraphQLFieldConfigMap<unknown, object> = {};
    Object.keys(fields).forEach((fieldName) => {
      const config = fields[fieldName];

      const fieldWrapper = mergeFieldWrappers(
        config,
        this.plugin.wrapOutputField(config, this.options),
      );
      const returnType = this.configStore.getTypeConfig(
        config.type.kind === 'List' ? config.type.type.ref : config.type.ref,
      );

      built[fieldName] = {
        ...config,
        type: this.buildOutputTypeParam(config.type),
        args: this.buildInputFields(config.args),
        extensions: {
          ...config.extensions,
          giraphqlOptions: config.giraphqlOptions,
        },
        resolve: wrapResolver(config, fieldWrapper, returnType),
        subscribe: wrapSubscriber(config, fieldWrapper),
      };
    });

    return built;
  }

  private buildInputFields(
    fields: Record<string, GiraphQLInputFieldConfig<Types>>,
  ): GraphQLInputFieldConfigMap {
    const built: GraphQLInputFieldConfigMap | GraphQLFieldConfigArgumentMap = {};

    Object.keys(fields).forEach((fieldName) => {
      const config = fields[fieldName];

      built[fieldName] = {
        ...config,
        type: this.buildInputTypeParam(config.type),
        extensions: {
          ...config.extensions,
          giraphqlOptions: config.giraphqlOptions,
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

    const fields = this.buildFields(type, configs);

    return {
      ...interfaceFields,
      ...fields,
    };
  }

  private getObjectFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    const interfaceFields = type
      .getInterfaces()
      .reduce((all, iface) => ({ ...this.getFields(iface), ...all }), {});

    const objectFields = this.buildFields(type, this.configStore.getFields(type.name, 'Object'));

    return { ...interfaceFields, ...objectFields };
  }

  private getRootFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    return this.buildFields(type, this.configStore.getFields(type.name, 'Object'));
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

  private buildObject({
    isTypeOf,
    ...config
  }:
    | GiraphQLObjectTypeConfig
    | GiraphQLQueryTypeConfig
    | GiraphQLMutationTypeConfig
    | GiraphQLSubscriptionTypeConfig) {
    const type: GraphQLObjectType = new GraphQLObjectType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
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
    const type: GraphQLInterfaceType = new GraphQLInterfaceType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
      },
      interfaces: () =>
        (config!).interfaces.map((iface) =>
          this.getTypeOfKind(iface, 'Interface'),
        ),
      fields: () => this.getFields(type),
      resolveType: wrapResolveType(this.configStore, async (parent, context, info) => {
        const implementers = this.getImplementers(type!);

        const results = await Promise.all(
          implementers.map((impl) =>
            impl.isTypeOf
              ? Promise.resolve(impl.isTypeOf(parent, context, info)).then((result) =>
                  result ? impl : null,
                )
              : null,
          ),
        );

        const resolved = results.find((result) => !!result);

        return resolved?.name;
      }),
    });

    return type;
  }

  private buildUnion(config: GiraphQLUnionTypeConfig) {
    return new GraphQLUnionType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
      },
      types: () => config.types.map((member) => this.getTypeOfKind(member, 'Object')),
      resolveType: wrapResolveType(this.configStore, async (...args) => {
        const result = await config.resolveType!(...args);

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
      }),
    });
  }

  private buildInputObject(config: GiraphQLInputObjectTypeConfig) {
    const type: GraphQLInputType = new GraphQLInputObjectType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
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
      },
    });
  }

  private buildEnum(config: GiraphQLEnumTypeConfig) {
    return new GraphQLEnumType({
      ...config,
      extensions: {
        ...config.extensions,
        giraphqlOptions: config.giraphqlOptions,
      },
    });
  }
}
