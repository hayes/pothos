import {
  GraphQLString,
  GraphQLInt,
  GraphQLID,
  GraphQLFloat,
  GraphQLBoolean,
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
} from 'graphql';
import { ResolverMap } from './types';
import {
  BasePlugin,
  assertNever,
  Resolver,
  FieldMap,
  InputFieldMap,
  GiraphQLObjectTypeConfig,
  GiraphQLQueryTypeConfig,
  GiraphQLSubscriptionTypeConfig,
  GiraphQLMutationTypeConfig,
  GiraphQLInterfaceTypeConfig,
  GiraphQLUnionTypeConfig,
  GiraphQLInputObjectTypeConfig,
  GiraphQLScalarTypeConfig,
  GiraphQLEnumTypeConfig,
  GiraphQLKindToGraphQLType,
  GiraphQLTypeKind,
  OutputType,
  SchemaTypes,
  InputType,
  ImplementableInputObjectRef,
} from '.';
import ConfigStore from './config-store';
import { ResolveValueWrapper } from './plugins';

export default class BuildCache {
  types = new Map<string, GraphQLNamedType>();

  private configStore: ConfigStore<any>;

  private plugin: Required<BasePlugin>;

  private mocks: ResolverMap;

  private implementers = new Map<string, GraphQLObjectType[]>();

  constructor(
    configStore: ConfigStore<any>,
    plugin: Required<BasePlugin>,
    {
      mocks,
    }: {
      mocks?: ResolverMap;
    } = {},
  ) {
    this.configStore = configStore;
    this.plugin = plugin;
    const scalars = [GraphQLID, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean];
    scalars.forEach((scalar) => {
      this.addType(scalar.name, scalar);
    });
    this.mocks = mocks ?? {};
  }

  getType(ref: string | OutputType<SchemaTypes> | InputType<SchemaTypes>) {
    const { name } = this.configStore.resolveImplementedRef(ref);
    const type = this.types.get(name);

    if (!type) {
      throw new TypeError(`Missing implementation of for type ${name}`);
    }

    return type;
  }

  getOutputType(ref: string | OutputType<SchemaTypes>): GraphQLOutputType {
    const type = this.getType(ref);

    if (type instanceof GraphQLInputObjectType) {
      throw new TypeError(
        `Expected ${ref} to be an output type but it was defined as an InputObject`,
      );
    }

    return type;
  }

  getInputType(ref: string | InputType<SchemaTypes>): GraphQLInputType {
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
    ref: string | OutputType<SchemaTypes> | InputType<SchemaTypes>,
    kind: T,
  ): GiraphQLKindToGraphQLType<T> {
    const type = this.getType(ref);

    switch (kind) {
      case 'Object':
      case 'Query':
      case 'Mutation':
      case 'Subscription':
        if (type instanceof GraphQLObjectType) {
          return type as GiraphQLKindToGraphQLType<T>;
        }
        break;
      case 'Interface':
        if (type instanceof GraphQLInterfaceType) {
          return type as GiraphQLKindToGraphQLType<T>;
        }
        break;
      case 'Union':
        if (type instanceof GraphQLUnionType) {
          return type as GiraphQLKindToGraphQLType<T>;
        }
        break;
      case 'Enum':
        if (type instanceof GraphQLEnumType) {
          return type as GiraphQLKindToGraphQLType<T>;
        }
        break;
      case 'Scalar':
        if (type instanceof GraphQLScalarType) {
          return type as GiraphQLKindToGraphQLType<T>;
        }
        break;
      case 'InputObject':
        if (type instanceof GraphQLScalarType) {
          return type as GiraphQLKindToGraphQLType<T>;
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

    const implementers = [...this.types.values()].filter(
      (type) => type instanceof GraphQLObjectType && type.getInterfaces().includes(iface),
    ) as GraphQLObjectType[];

    this.implementers.set(iface.name, implementers);

    return implementers;
  }

  resolverMock(
    typename: string,
    fieldName: string,
  ): Resolver<unknown, unknown, unknown, unknown> | null {
    const fieldMock = (this.mocks[typename] && this.mocks[typename][fieldName]) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return fieldMock;
    }

    return fieldMock.resolve || null;
  }

  subscribeMock(
    typename: string,
    fieldName: string,
  ): Resolver<unknown, unknown, unknown, unknown> | null {
    const fieldMock = (this.mocks[typename] && this.mocks[typename][fieldName]) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return null;
    }

    return fieldMock.subscribe || null;
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

    for (const entry of this.types.values()) {
      this.plugin.visitType(entry, this);
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

  private buildFields(
    type: GraphQLObjectType | GraphQLInterfaceType,
    fields: FieldMap,
  ): GraphQLFieldConfigMap<unknown, object> {
    const built: GraphQLFieldConfigMap<unknown, object> = {};

    Object.keys(fields).forEach((fieldName) => {
      built[fieldName] = fields[fieldName].build(type, fieldName, this, this.plugin);
    });

    return built;
  }

  private buildInputFields(fields: InputFieldMap): GraphQLInputFieldConfigMap {
    const built: GraphQLInputFieldConfigMap = {};

    Object.keys(fields).forEach((fieldName) => {
      built[fieldName] = fields[fieldName].build(this);
    });

    return built;
  }

  private mergeFields(
    typename: string,
    base: GraphQLFieldConfigMap<unknown, object>,
    newFields: GraphQLFieldConfigMap<unknown, object>,
    allowOverwrite = false,
  ): GraphQLFieldConfigMap<unknown, object> {
    if (!allowOverwrite) {
      Object.keys(newFields).forEach((key) => {
        if (base[key]) {
          throw new Error(`Duplicate field definition detected for field ${key} in ${typename}`);
        }
      });
    }

    return {
      ...base,
      ...newFields,
    };
  }

  private mergeInputFields(
    typename: string,
    base: GraphQLInputFieldConfigMap,
    newFields: GraphQLInputFieldConfigMap,
  ): GraphQLInputFieldConfigMap {
    Object.keys(newFields).forEach((key) => {
      if (base[key]) {
        throw new Error(`Duplicate field definition detected for field ${key} in ${typename}`);
      }
    });

    return {
      ...base,
      ...newFields,
    };
  }

  private getInterfaceFields(type: GraphQLInterfaceType): GraphQLFieldConfigMap<unknown, object> {
    return this.configStore
      .getFields(type.name)
      .reduce(
        (fields, newFields) =>
          this.mergeFields(type.name, fields, this.buildFields(type, newFields)),
        {} as GraphQLFieldConfigMap<unknown, object>,
      );
  }

  private getObjectFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    const interfaceFields = type
      .getInterfaces()
      .reduce((all, iface) => this.mergeFields(type.name, all, this.getFields(iface), true), {});

    const objectFields = this.configStore
      .getFields(type.name)
      .reduce(
        (fields, newFields, i) =>
          this.mergeFields(type.name, fields, this.buildFields(type, newFields)),
        {} as GraphQLFieldConfigMap<unknown, object>,
      );

    return this.mergeFields(type.name, interfaceFields, objectFields, true);
  }

  private getRootFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    return this.configStore
      .getFields(type.name)
      .reduce(
        (fields, newFields) =>
          this.mergeFields(type.name, fields, this.buildFields(type, newFields)),
        {} as GraphQLFieldConfigMap<unknown, object>,
      );
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
    return this.configStore
      .getInputFields(type.name)
      .reduce(
        (fields, newFields) =>
          this.mergeInputFields(type.name, fields, this.buildInputFields(newFields)),
        {} as GraphQLInputFieldConfigMap,
      );
  }

  private buildObject(
    config:
      | GiraphQLObjectTypeConfig
      | GiraphQLQueryTypeConfig
      | GiraphQLMutationTypeConfig
      | GiraphQLSubscriptionTypeConfig,
  ) {
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
      isTypeOf:
        config.isTypeOf &&
        (async (parent, context, info) => {
          const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;

          return config.isTypeOf!(obj, context, info);
        }),
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
      fields: () => this.getFields(type),
      resolveType: async (parent, context, info) => {
        const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;

        const implementers = this.getImplementers(type as GraphQLInterfaceType);

        const results = await Promise.all(
          implementers.map((impl) =>
            impl.isTypeOf
              ? Promise.resolve(impl.isTypeOf(obj, context, info)).then((result) =>
                  result ? impl : null,
                )
              : null,
          ),
        );

        const resolved = results.find((result) => !!result);

        if (!resolved) {
          return resolved;
        }

        await this.plugin.onInterfaceResolveType(resolved, parent, context, info);

        return resolved;
      },
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
      resolveType: async (parent, context, info, abstractType) => {
        const obj = parent instanceof ResolveValueWrapper ? parent.value : parent;

        const typeOrTypename = await config.resolveType!(obj, context, info, abstractType);

        if (!typeOrTypename) {
          return typeOrTypename;
        }

        const type =
          typeof typeOrTypename === 'string'
            ? this.getTypeOfKind(typeOrTypename, 'Object')
            : typeOrTypename;

        await this.plugin.onUnionResolveType(type, parent, context, info);

        return typeOrTypename;
      },
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
