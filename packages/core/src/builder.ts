import {
  GraphQLBoolean,
  GraphQLDirective,
  GraphQLFloat,
  GraphQLID,
  GraphQLInt,
  GraphQLObjectType,
  GraphQLScalarSerializer,
  GraphQLScalarType,
  GraphQLSchema,
  GraphQLString,
  GraphQLTypeResolver,
  lexicographicSortSchema,
} from 'graphql';
import BuildCache from './build-cache';
import ConfigStore from './config-store';
import { PothosError, PothosSchemaError } from './errors';
import InputFieldBuilder from './fieldUtils/input';
import InterfaceFieldBuilder from './fieldUtils/interface';
import MutationFieldBuilder from './fieldUtils/mutation';
import ObjectFieldBuilder from './fieldUtils/object';
import QueryFieldBuilder from './fieldUtils/query';
import SubscriptionFieldBuilder from './fieldUtils/subscription';
import BaseTypeRef from './refs/base';
import EnumRef from './refs/enum';
import InputObjectRef, { ImplementableInputObjectRef } from './refs/input-object';
import InterfaceRef, { ImplementableInterfaceRef } from './refs/interface';
import ObjectRef, { ImplementableObjectRef } from './refs/object';
import ScalarRef from './refs/scalar';
import UnionRef from './refs/union';
import type {
  AbstractReturnShape,
  BaseEnum,
  EnumParam,
  EnumTypeOptions,
  EnumValues,
  InputFieldMap,
  InputFieldsFromShape,
  InputShape,
  InputShapeFromFields,
  InterfaceFieldsShape,
  InterfaceFieldThunk,
  InterfaceParam,
  InterfaceTypeOptions,
  MutationFieldsShape,
  MutationFieldThunk,
  NormalizeArgs,
  NormalizeSchemeBuilderOptions,
  ObjectFieldsShape,
  ObjectFieldThunk,
  ObjectParam,
  ObjectTypeOptions,
  OutputShape,
  OutputType,
  ParentShape,
  PluginConstructorMap,
  PothosEnumTypeConfig,
  PothosInputObjectTypeConfig,
  PothosInterfaceTypeConfig,
  PothosMutationTypeConfig,
  PothosObjectTypeConfig,
  PothosQueryTypeConfig,
  PothosScalarTypeConfig,
  PothosSubscriptionTypeConfig,
  PothosUnionTypeConfig,
  QueryFieldsShape,
  QueryFieldThunk,
  RecursivelyNormalizeNullableFields,
  ScalarName,
  SchemaTypes,
  ShapeFromEnumValues,
  SubscriptionFieldsShape,
  SubscriptionFieldThunk,
  ValuesFromEnum,
} from './types';
import { normalizeEnumValues, valuesFromEnum, verifyInterfaces, verifyRef } from './utils';

export default class SchemaBuilder<Types extends SchemaTypes> {
  static plugins: Partial<PluginConstructorMap<SchemaTypes>> = {};

  static allowPluginReRegistration = false;

  configStore: ConfigStore<Types>;

  options: NormalizeSchemeBuilderOptions<Types>;

  defaultFieldNullability: boolean;

  defaultInputFieldRequiredness: boolean;

  constructor(options: NormalizeSchemeBuilderOptions<Types>) {
    this.options = options;

    this.configStore = new ConfigStore<Types>();

    this.defaultFieldNullability =
      (
        options as {
          defaultFieldNullability?: boolean;
        }
      ).defaultFieldNullability ?? false;

    this.defaultInputFieldRequiredness =
      (
        options as {
          defaultInputFieldRequiredness?: boolean;
        }
      ).defaultInputFieldRequiredness ?? false;
  }

  static registerPlugin<T extends keyof PluginConstructorMap<SchemaTypes>>(
    name: T,
    plugin: PluginConstructorMap<SchemaTypes>[T],
  ) {
    if (!this.allowPluginReRegistration && this.plugins[name]) {
      throw new PothosError(`Received multiple implementations for plugin ${name}`);
    }

    this.plugins[name] = plugin;
  }

  objectType<Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(
    param: Param,
    options: ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>,
    fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>,
  ) {
    verifyRef(param);
    verifyInterfaces(options.interfaces);

    const name =
      typeof param === 'string'
        ? param
        : (options as { name?: string }).name ?? (param as { name: string }).name;

    if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
      throw new PothosSchemaError(`Invalid object name ${name} use .create${name}Type() instead`);
    }

    const ref =
      param instanceof BaseTypeRef
        ? (param as ObjectRef<OutputShape<Types, Param>, ParentShape<Types, Param>>)
        : new ObjectRef<OutputShape<Types, Param>, ParentShape<Types, Param>>(name);

    const config: PothosObjectTypeConfig = {
      kind: 'Object',
      graphqlKind: 'Object',
      name,
      interfaces: [],
      description: options.description,
      extensions: options.extensions,
      isTypeOf: options.isTypeOf,
      pothosOptions: options as PothosSchemaTypes.ObjectTypeOptions,
    };

    this.configStore.addTypeConfig(config, ref);

    if (options.interfaces) {
      this.configStore.addInterfaces(name, options.interfaces);
    }

    if (typeof param === 'function') {
      this.configStore.associateRefWithName(param, name);
    }

    if (fields) {
      this.configStore.addFields(ref, () =>
        fields(new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(name, this)),
      );
    }

    if (options.fields) {
      this.configStore.addFields(ref, () => {
        const t = new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(name, this);

        return options.fields!(t);
      });
    }

    return ref;
  }

  objectFields<Type extends ObjectParam<Types>>(
    ref: Type,
    fields: ObjectFieldsShape<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(ref);
    this.configStore.onTypeConfig(ref, ({ name }) => {
      this.configStore.addFields(ref, () => fields(new ObjectFieldBuilder(name, this)));
    });
  }

  objectField<Type extends ObjectParam<Types>>(
    ref: Type,
    fieldName: string,
    field: ObjectFieldThunk<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(ref);
    this.configStore.onTypeConfig(ref, ({ name }) => {
      this.configStore.addFields(ref, () => ({
        [fieldName]: field(new ObjectFieldBuilder(name, this)),
      }));
    });
  }

  queryType(
    ...args: NormalizeArgs<
      [options: PothosSchemaTypes.QueryTypeOptions<Types>, fields?: QueryFieldsShape<Types>],
      0
    >
  ) {
    const [options = {}, fields] = args;
    const config: PothosQueryTypeConfig = {
      kind: 'Query',
      graphqlKind: 'Object',
      name: 'Query',
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.QueryTypeOptions,
      extensions: options.extensions,
    };

    const ref = new ObjectRef<OutputShape<Types, 'Query'>, ParentShape<Types, 'Query'>>('Query');

    this.configStore.addTypeConfig(config, ref);

    if (fields) {
      this.configStore.addFields('Query', () => fields(new QueryFieldBuilder(this)));
    }

    if (options.fields) {
      this.configStore.addFields('Query', () => options.fields!(new QueryFieldBuilder(this)));
    }

    return ref;
  }

  queryFields(fields: QueryFieldsShape<Types>) {
    this.configStore.addFields('Query', () => fields(new QueryFieldBuilder(this)));
  }

  queryField(name: string, field: QueryFieldThunk<Types>) {
    this.configStore.addFields('Query', () => ({
      [name]: field(new QueryFieldBuilder(this)),
    }));
  }

  mutationType(
    ...args: NormalizeArgs<
      [options: PothosSchemaTypes.MutationTypeOptions<Types>, fields?: MutationFieldsShape<Types>],
      0
    >
  ) {
    const [options = {}, fields] = args;
    const config: PothosMutationTypeConfig = {
      kind: 'Mutation',
      graphqlKind: 'Object',
      name: 'Mutation',
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.MutationTypeOptions,
      extensions: options.extensions,
    };

    this.configStore.addTypeConfig(config);

    if (fields) {
      this.configStore.addFields('Mutation', () => fields(new MutationFieldBuilder(this)));
    }

    if (options.fields) {
      this.configStore.addFields('Mutation', () => options.fields!(new MutationFieldBuilder(this)));
    }
  }

  mutationFields(fields: MutationFieldsShape<Types>) {
    this.configStore.addFields('Mutation', () => fields(new MutationFieldBuilder(this)));
  }

  mutationField(name: string, field: MutationFieldThunk<Types>) {
    this.configStore.addFields('Mutation', () => ({
      [name]: field(new MutationFieldBuilder(this)),
    }));
  }

  subscriptionType(
    ...args: NormalizeArgs<
      [
        options: PothosSchemaTypes.SubscriptionTypeOptions<Types>,
        fields?: SubscriptionFieldsShape<Types>,
      ],
      0
    >
  ) {
    const [options = {}, fields] = args;
    const config: PothosSubscriptionTypeConfig = {
      kind: 'Subscription',
      graphqlKind: 'Object',
      name: 'Subscription',
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.SubscriptionTypeOptions,
      extensions: options.extensions,
    };

    this.configStore.addTypeConfig(config);

    if (fields) {
      this.configStore.addFields('Subscription', () => fields(new SubscriptionFieldBuilder(this)));
    }

    if (options.fields) {
      this.configStore.addFields('Subscription', () =>
        options.fields!(new SubscriptionFieldBuilder(this)),
      );
    }
  }

  subscriptionFields(fields: SubscriptionFieldsShape<Types>) {
    this.configStore.addFields('Subscription', () => fields(new SubscriptionFieldBuilder(this)));
  }

  subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
    this.configStore.addFields('Subscription', () => ({
      [name]: field(new SubscriptionFieldBuilder(this)),
    }));
  }

  args<Shape extends InputFieldMap>(
    fields: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Shape,
  ): Shape {
    return fields(new InputFieldBuilder<Types, 'Arg'>(this, 'Arg', '[unknown]'));
  }

  interfaceType<
    Param extends InterfaceParam<Types>,
    Interfaces extends InterfaceParam<Types>[],
    ResolveType,
  >(
    param: Param,
    options: InterfaceTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces, ResolveType>,
    fields?: InterfaceFieldsShape<Types, ParentShape<Types, Param>>,
  ) {
    verifyRef(param);
    verifyInterfaces(options.interfaces);

    const name =
      typeof param === 'string'
        ? param
        : (options as { name?: string }).name ?? (param as { name: string }).name;

    const ref =
      param instanceof BaseTypeRef
        ? (param as InterfaceRef<
            AbstractReturnShape<Types, Param, ResolveType>,
            ParentShape<Types, Param>
          >)
        : new InterfaceRef<
            AbstractReturnShape<Types, Param, ResolveType>,
            ParentShape<Types, Param>
          >(name);

    const typename = ref.name;

    const config: PothosInterfaceTypeConfig = {
      kind: 'Interface',
      graphqlKind: 'Interface',
      name: typename,
      interfaces: [],
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.InterfaceTypeOptions,
      extensions: options.extensions,
      resolveType: options.resolveType as GraphQLTypeResolver<unknown, unknown>,
    };

    this.configStore.addTypeConfig(config, ref);

    if (options.interfaces) {
      this.configStore.addInterfaces(typename, options.interfaces);
    }

    if (typeof param === 'function') {
      this.configStore.associateRefWithName(param, name);
    }

    if (fields) {
      this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(typename, this)));
    }

    if (options.fields) {
      this.configStore.addFields(ref, () =>
        options.fields!(new InterfaceFieldBuilder(typename, this)),
      );
    }

    return ref;
  }

  interfaceFields<Type extends InterfaceParam<Types>>(
    ref: Type,
    fields: InterfaceFieldsShape<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(ref);
    this.configStore.onTypeConfig(ref, ({ name }) => {
      this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(name, this)));
    });
  }

  interfaceField<Type extends InterfaceParam<Types>>(
    ref: Type,
    fieldName: string,
    field: InterfaceFieldThunk<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(ref);
    this.configStore.onTypeConfig(ref, ({ name }) => {
      this.configStore.addFields(ref, () => ({
        [fieldName]: field(new InterfaceFieldBuilder(name, this)),
      }));
    });
  }

  unionType<Member extends ObjectParam<Types>, ResolveType>(
    name: string,
    options: PothosSchemaTypes.UnionTypeOptions<Types, Member, ResolveType>,
  ) {
    const ref = new UnionRef<
      AbstractReturnShape<Types, Member, ResolveType>,
      ParentShape<Types, Member>
    >(name);

    if (Array.isArray(options.types)) {
      options.types.forEach((type) => {
        verifyRef(type);
      });
    }

    const config: PothosUnionTypeConfig = {
      kind: 'Union',
      graphqlKind: 'Union',
      name,
      types: [],
      description: options.description,
      resolveType: options.resolveType as GraphQLTypeResolver<unknown, object>,
      pothosOptions: options as unknown as PothosSchemaTypes.UnionTypeOptions,
      extensions: options.extensions,
    };

    this.configStore.addTypeConfig(config, ref);
    this.configStore.addUnionTypes(name, options.types);

    return ref;
  }

  enumType<Param extends EnumParam, Values extends EnumValues<Types>>(
    param: Param,
    options: EnumTypeOptions<Types, Param, Values>,
  ) {
    verifyRef(param);
    const name = typeof param === 'string' ? param : (options as { name: string }).name;
    const ref = new EnumRef<
      Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>
    >(name);

    const values =
      typeof param === 'object'
        ? valuesFromEnum<Types>(
            param as BaseEnum,
            options?.values as Record<string, PothosSchemaTypes.EnumValueConfig<Types>>,
          )
        : normalizeEnumValues<Types>((options as { values: EnumValues<Types> }).values);

    const config: PothosEnumTypeConfig = {
      kind: 'Enum',
      graphqlKind: 'Enum',
      name,
      values,
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.EnumTypeOptions<Types>,
      extensions: options.extensions,
    };

    this.configStore.addTypeConfig(config, ref);

    if (typeof param !== 'string') {
      this.configStore.associateRefWithName(param as BaseEnum, name);
    }

    return ref;
  }

  scalarType<Name extends ScalarName<Types>>(
    name: Name,
    options: PothosSchemaTypes.ScalarTypeOptions<
      Types,
      InputShape<Types, Name>,
      ParentShape<Types, Name>
    >,
  ) {
    const ref = new ScalarRef<InputShape<Types, Name>, ParentShape<Types, Name>>(name);

    const config: PothosScalarTypeConfig = {
      kind: 'Scalar',
      graphqlKind: 'Scalar',
      name,
      description: options.description,
      parseLiteral: options.parseLiteral,
      parseValue: options.parseValue,
      serialize: options.serialize as GraphQLScalarSerializer<OutputShape<Types, Name>>,
      pothosOptions: options as unknown as PothosSchemaTypes.ScalarTypeOptions,
      extensions: options.extensions,
    };

    this.configStore.addTypeConfig(config, ref);

    return ref;
  }

  addScalarType<Name extends ScalarName<Types>>(
    name: Name,
    scalar: GraphQLScalarType,
    ...args: NormalizeArgs<
      [
        options: Omit<
          PothosSchemaTypes.ScalarTypeOptions<
            Types,
            InputShape<Types, Name>,
            OutputShape<Types, Name>
          >,
          'serialize'
        > & {
          serialize?: GraphQLScalarSerializer<OutputShape<Types, Name>>;
        },
      ]
    >
  ) {
    const [options = {}] = args;
    const config = scalar.toConfig();

    return this.scalarType<Name>(name, {
      ...config,
      ...options,
      extensions: {
        ...config.extensions,
        ...options.extensions,
      },
    } as PothosSchemaTypes.ScalarTypeOptions<
      Types,
      InputShape<Types, Name>,
      ParentShape<Types, Name>
    >);
  }

  inputType<
    Param extends InputObjectRef<unknown> | string,
    Fields extends Param extends PothosSchemaTypes.InputObjectRef<unknown>
      ? InputFieldsFromShape<InputShape<Types, Param>>
      : Param extends keyof Types['Inputs']
        ? InputFieldsFromShape<InputShape<Types, Param>>
        : InputFieldMap,
  >(
    param: Param,
    options: PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>,
  ): PothosSchemaTypes.InputObjectRef<InputShapeFromFields<Fields>> {
    verifyRef(param);
    const name = typeof param === 'string' ? param : (param as { name: string }).name;

    const ref = (
      typeof param === 'string' ? new InputObjectRef<InputShapeFromFields<Fields>>(name) : param
    ) as PothosSchemaTypes.InputObjectRef<InputShapeFromFields<Fields>>;

    const config: PothosInputObjectTypeConfig & { isOneOf?: boolean } = {
      kind: 'InputObject',
      graphqlKind: 'InputObject',
      name,
      isOneOf: options.isOneOf,
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.InputObjectTypeOptions,
      extensions: options.extensions,
    };

    this.configStore.addTypeConfig(config, ref);

    this.configStore.addFields(ref, () =>
      options.fields(new InputFieldBuilder(this, 'InputObject', name)),
    );

    return ref;
  }

  inputRef<T extends object, Normalize = true>(
    name: string,
  ): ImplementableInputObjectRef<
    Types,
    RecursivelyNormalizeNullableFields<T>,
    Normalize extends false ? T : RecursivelyNormalizeNullableFields<T>
  > {
    return new ImplementableInputObjectRef<
      Types,
      RecursivelyNormalizeNullableFields<T>,
      Normalize extends false ? T : RecursivelyNormalizeNullableFields<T>
    >(this, name);
  }

  objectRef<T>(name: string): ImplementableObjectRef<Types, T> {
    return new ImplementableObjectRef<Types, T>(this, name);
  }

  interfaceRef<T>(name: string): ImplementableInterfaceRef<Types, T> {
    return new ImplementableInterfaceRef<Types, T>(this, name);
  }

  toSchema(...args: NormalizeArgs<[options?: PothosSchemaTypes.BuildSchemaOptions<Types>]>) {
    const [options = {}] = args;
    const { directives, extensions } = options;

    const scalars = [GraphQLID, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean];
    scalars.forEach((scalar) => {
      if (!this.configStore.hasConfig(scalar.name as OutputType<Types>)) {
        this.addScalarType(scalar.name as ScalarName<Types>, scalar);
      }
    });

    const buildCache = new BuildCache(this, options);

    buildCache.plugin.beforeBuild();

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()];

    const schema = new GraphQLSchema({
      query: buildCache.types.get('Query') as GraphQLObjectType | undefined,
      mutation: buildCache.types.get('Mutation') as GraphQLObjectType | undefined,
      subscription: buildCache.types.get('Subscription') as GraphQLObjectType | undefined,
      extensions: extensions ?? {},
      directives: directives as GraphQLDirective[],
      types: builtTypes,
    });

    const processedSchema = buildCache.plugin.afterBuild(schema);

    return options.sortSchema === false
      ? processedSchema
      : lexicographicSortSchema(processedSchema);
  }
}
