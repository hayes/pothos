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
import { BasePlugin, assertNever, Resolver, FieldMap, InputFieldMap } from '.';
import ConfigStore from './config-store';

export default class BuildCache {
  types = new Map<string, GraphQLNamedType>();

  plugin: Required<BasePlugin>;

  mocks: ResolverMap;

  configStore: ConfigStore<any>;

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

  getOutputType(name: string): GraphQLOutputType {
    const type = this.types.get(name);

    if (!type) {
      throw new TypeError(`Missing implementation of for type ${name}`);
    }

    if (type instanceof GraphQLInputObjectType) {
      throw new TypeError(
        `Expected ${name} to be an output type but it was defined as an InputObject`,
      );
    }

    return type;
  }

  getObjectType(name: string) {
    const type = this.getOutputType(name);

    if (!(type instanceof GraphQLObjectType)) {
      throw new TypeError(`Expected ${type} to be a GraphQLObject`);
    }

    return type;
  }

  getInterfaceType(name: string) {
    const type = this.getOutputType(name);

    if (!(type instanceof GraphQLInterfaceType)) {
      throw new TypeError(`Expected ${type} to be an GraphQLInterface`);
    }

    return type;
  }

  getInputType(name: string): GraphQLInputType {
    const type = this.types.get(name);

    if (!type) {
      throw new TypeError(`Missing implementation of for type ${name}`);
    }

    if (type instanceof GraphQLObjectType) {
      throw new TypeError(
        `Expected ${name} to be an output type but it was defined as an InputObject`,
      );
    }

    if (type instanceof GraphQLInterfaceType) {
      throw new TypeError(
        `Expected ${name} to be an output type but it was defined as an InputObject`,
      );
    }

    if (type instanceof GraphQLUnionType) {
      throw new TypeError(
        `Expected ${name} to be an output type but it was defined as an InputObject`,
      );
    }

    return type;
  }

  addType(ref: string, type: GraphQLNamedType) {
    if (this.types.has(ref)) {
      throw new Error(
        `reference or name has already been used to create another type (${type.name})`,
      );
    }

    this.types.set(ref, type);
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

  private buildFields(fields: FieldMap): GraphQLFieldConfigMap<unknown, object> {
    const built: GraphQLFieldConfigMap<unknown, object> = {};

    Object.keys(fields).forEach((fieldName) => {
      built[fieldName] = fields[fieldName].build(fieldName, this, this.plugin);
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
        (fields, newFields) => this.mergeFields(type.name, fields, this.buildFields(newFields)),
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
        (fields, newFields, i) => this.mergeFields(type.name, fields, this.buildFields(newFields)),
        {} as GraphQLFieldConfigMap<unknown, object>,
      );

    return this.mergeFields(type.name, interfaceFields, objectFields, true);
  }

  private getRootFields(type: GraphQLObjectType): GraphQLFieldConfigMap<unknown, object> {
    return this.configStore
      .getFields(type.name)
      .reduce(
        (fields, newFields) => this.mergeFields(type.name, fields, this.buildFields(newFields)),
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

  buildAll() {
    this.configStore.nameToKind.forEach((kind, name) => {
      let type: GraphQLNamedType;

      switch (kind) {
        case 'enums':
          this.addType(name, new GraphQLEnumType(this.configStore.enums.get(name)!));
          break;
        case 'inputs':
          type = new GraphQLInputObjectType({
            ...this.configStore.inputs.get(name)!,
            fields: () => this.getInputFields(type as GraphQLInputObjectType),
          });
          this.addType(name, type);
          break;
        case 'interfaces':
          type = new GraphQLInterfaceType({
            ...this.configStore.interfaces.get(name)!,
            fields: () => this.getFields(type),
          });
          this.addType(name, type);
          break;
        case 'objects':
          type = new GraphQLObjectType({
            ...this.configStore.objects.get(name)!,
            fields: () => this.getFields(type),
            interfaces: () =>
              this.configStore
                .getImplementedInterfaces(name)
                .map((iface) => this.getInterfaceType(this.configStore.getNameFromRef(iface))),
          });

          this.addType(name, type);
          break;
        case 'scalars':
          this.addType(name, new GraphQLScalarType(this.configStore.scalars.get(name)!));
          break;
        case 'unions':
          this.addType(
            name,
            new GraphQLUnionType({
              ...this.configStore.unions.get(name)!,
              types: () =>
                this.configStore.getUnionMembers(name).map((member) => this.getObjectType(member)),
            }),
          );
          break;
        default:
          assertNever(kind);
      }
    });

    for (const entry of this.types.values()) {
      this.plugin.visitType(entry, this);
    }
  }
}
