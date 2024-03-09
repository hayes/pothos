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
import { BuildCache } from './build-cache';
import { ConfigStore } from './config-store';
import { PothosError, PothosSchemaError } from './errors';
import { InputFieldBuilder } from './fieldUtils/input';
import { InterfaceFieldBuilder } from './fieldUtils/interface';
import { MutationFieldBuilder } from './fieldUtils/mutation';
import { ObjectFieldBuilder } from './fieldUtils/object';
import { QueryFieldBuilder } from './fieldUtils/query';
import { SubscriptionFieldBuilder } from './fieldUtils/subscription';
import { BaseTypeRef } from './refs/base';
import { EnumRef } from './refs/enum';
import { FieldRef } from './refs/field';
import { ImplementableInputObjectRef, InputObjectRef } from './refs/input-object';
import { ImplementableInterfaceRef, InterfaceRef } from './refs/interface';
import { MutationRef } from './refs/mutation';
import { ImplementableObjectRef, ObjectRef } from './refs/object';
import { QueryRef } from './refs/query';
import { ScalarRef } from './refs/scalar';
import { SubscriptionRef } from './refs/subscription';
import { UnionRef } from './refs/union';
import type {
  AbstractReturnShape,
  AddVersionedDefaultsToBuilderOptions,
  BaseEnum,
  ConfigurableRef,
  EnumParam,
  EnumTypeOptions,
  EnumValues,
  FieldKind,
  FieldMode,
  FieldNullability,
  FieldOptionNormalizer,
  FieldOptionsFromKind,
  FieldRefFromMode,
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
  ParentShape,
  PluginConstructorMap,
  PothosInputFieldConfig,
  PothosInputObjectTypeConfig,
  PothosOutputFieldConfig,
  QueryFieldsShape,
  QueryFieldThunk,
  RecursivelyNormalizeNullableFields,
  ScalarName,
  SchemaTypes,
  ShapeFromEnumValues,
  SubscriptionFieldsShape,
  SubscriptionFieldThunk,
  TypeParam,
  ValuesFromEnum,
} from './types';
import {
  nonNullableFromOptions,
  normalizeEnumValues,
  typeFromParam,
  valuesFromEnum,
  verifyInterfaces,
  verifyRef,
} from './utils';

export class SchemaBuilder<Types extends SchemaTypes> {
  static plugins: Partial<PluginConstructorMap<SchemaTypes>> = {};

  static optionNormalizers: Map<
    string,
    {
      v3?: (
        options: AddVersionedDefaultsToBuilderOptions<SchemaTypes, 'v3'>,
      ) => Partial<NormalizeSchemeBuilderOptions<SchemaTypes>>;
      v4?: undefined;
    }
  > = new Map();

  static fieldOptionNormalizers: FieldOptionNormalizer = {
    v3: (builder, name, options, type = options.type) => {
      const { resolve } = options as { resolve?: (...argList: unknown[]) => unknown };
      const { subscribe } = options as { subscribe?: (...argList: unknown[]) => unknown };

      return {
        args: options.args,
        type:
          type &&
          typeFromParam(type, builder.configStore, nonNullableFromOptions(builder, options)),
        extensions: {
          pothosOriginalResolve: resolve,
          pothosOriginalSubscribe: subscribe,
          ...options.extensions,
        },
        description: options.description,
        deprecationReason: options.deprecationReason,
        resolve,
        subscribe,
      };
    },
  };

  static allowPluginReRegistration = false;

  configStore: ConfigStore<Types>;

  options: PothosSchemaTypes.SchemaBuilderOptions<Types>;

  defaultFieldNullability: boolean;

  defaultInputFieldRequiredness: boolean;

  private fieldMode: Types['FieldMode'] = 'v3';

  constructor(options: PothosSchemaTypes.SchemaBuilderOptions<Types>) {
    this.options = [...SchemaBuilder.optionNormalizers.values()].reduce((opts, normalize) => {
      if (options.defaults && typeof normalize[options.defaults] === 'function') {
        // eslint-disable-next-line @typescript-eslint/consistent-type-assertions
        return {
          ...opts,
          ...normalize[options.defaults]!(opts),
        } as PothosSchemaTypes.SchemaBuilderOptions<Types>;
      }

      return opts;
    }, options);

    this.configStore = new ConfigStore<Types>(this);

    this.defaultFieldNullability =
      (
        options as {
          defaultFieldNullability?: boolean;
        }
      ).defaultFieldNullability ??
      // eslint-disable-next-line no-unneeded-ternary
      (options.defaults === 'v3' ? false : true);

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
    options?: {
      normalizeOptions?: {
        v3?: (
          options: AddVersionedDefaultsToBuilderOptions<SchemaTypes, 'v3'>,
        ) => Partial<NormalizeSchemeBuilderOptions<SchemaTypes>>;
      };
    },
  ) {
    if (!this.allowPluginReRegistration && this.plugins[name]) {
      throw new PothosError(`Received multiple implementations for plugin ${name}`);
    }

    this.plugins[name] = plugin;

    if (options?.normalizeOptions) {
      this.optionNormalizers.set(name, options.normalizeOptions);
    }
  }

  objectType<Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(
    param: Param,
    options: ObjectTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces>,
    fields?: ObjectFieldsShape<Types, ParentShape<Types, Param>>,
  ): PothosSchemaTypes.ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>> {
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
        ? (param as ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>>)
        : new ObjectRef<Types, OutputShape<Types, Param>, ParentShape<Types, Param>>(name);

    ref.updateConfig({
      kind: 'Object',
      graphqlKind: 'Object',
      name,
      interfaces: [],
      description: options.description,
      extensions: options.extensions,
      isTypeOf: options.isTypeOf,
      pothosOptions: options as PothosSchemaTypes.ObjectTypeOptions,
    });

    if (options.interfaces) {
      ref.addInterfaces(options.interfaces);
    }

    if (ref !== param && typeof param !== 'string') {
      this.configStore.associateParamWithRef(param, ref);
    }

    if (fields) {
      ref.addFields(() =>
        fields(new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(this, this.fieldMode)),
      );
    }

    if (options.fields) {
      ref.addFields(() => {
        const t = new ObjectFieldBuilder<Types, ParentShape<Types, Param>>(this, this.fieldMode);

        return options.fields!(t);
      });
    }

    this.configStore.addTypeRef(ref);

    return ref;
  }

  objectFields<Type extends ObjectParam<Types>>(
    param: Type,
    fields: ObjectFieldsShape<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(param);
    this.configStore.addFields(param, () =>
      fields(new ObjectFieldBuilder<Types, ParentShape<Types, Type>>(this, this.fieldMode)),
    );
  }

  objectField<Type extends ObjectParam<Types>>(
    param: Type,
    fieldName: string,
    field: ObjectFieldThunk<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(param);
    this.configStore.addFields(param, () => ({
      [fieldName]: field(
        new ObjectFieldBuilder<Types, ParentShape<Types, Type>>(this, this.fieldMode),
      ),
    }));
  }

  queryType(
    ...args: NormalizeArgs<
      [options: PothosSchemaTypes.QueryTypeOptions<Types>, fields?: QueryFieldsShape<Types>],
      0
    >
  ): QueryRef<Types> {
    const [options = {}, fields] = args;

    const ref = new QueryRef<Types>('Query', {
      kind: 'Query',
      graphqlKind: 'Object',
      name: 'Query',
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.QueryTypeOptions,
      extensions: options.extensions,
    });

    this.configStore.addTypeRef(ref);

    if (fields) {
      ref.addFields(() => fields(new QueryFieldBuilder(this, this.fieldMode)));
    }

    if (options.fields) {
      ref.addFields(() => options.fields!(new QueryFieldBuilder(this, this.fieldMode)));
    }

    return ref;
  }

  queryFields(fields: QueryFieldsShape<Types>) {
    this.configStore.addFields('Query', () => fields(new QueryFieldBuilder(this, this.fieldMode)));
  }

  queryField(name: string, field: QueryFieldThunk<Types>) {
    this.configStore.addFields('Query', () => ({
      [name]: field(new QueryFieldBuilder(this, this.fieldMode)),
    }));
  }

  mutationType(
    ...args: NormalizeArgs<
      [options: PothosSchemaTypes.MutationTypeOptions<Types>, fields?: MutationFieldsShape<Types>],
      0
    >
  ) {
    const [options = {}, fields] = args;

    const ref = new MutationRef<Types>('Mutation', {
      kind: 'Mutation',
      graphqlKind: 'Object',
      name: 'Mutation',
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.MutationTypeOptions,
      extensions: options.extensions,
    });

    this.configStore.addTypeRef(ref);

    if (fields) {
      this.configStore.addFields('Mutation', () =>
        fields(new MutationFieldBuilder(this, this.fieldMode)),
      );
    }

    if (options.fields) {
      this.configStore.addFields('Mutation', () =>
        options.fields!(new MutationFieldBuilder(this, this.fieldMode)),
      );
    }

    return ref;
  }

  mutationFields(fields: MutationFieldsShape<Types>) {
    this.configStore.addFields('Mutation', () =>
      fields(new MutationFieldBuilder(this, this.fieldMode)),
    );
  }

  mutationField(name: string, field: MutationFieldThunk<Types>) {
    this.configStore.addFields('Mutation', () => ({
      [name]: field(new MutationFieldBuilder(this, this.fieldMode)),
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

    const ref = new SubscriptionRef<Types>('Subscription', {
      kind: 'Subscription',
      graphqlKind: 'Object',
      name: 'Subscription',
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.SubscriptionTypeOptions,
      extensions: options.extensions,
    });

    this.configStore.addTypeRef(ref);

    if (fields) {
      this.configStore.addFields('Subscription', () =>
        fields(new SubscriptionFieldBuilder(this, this.fieldMode)),
      );
    }

    if (options.fields) {
      this.configStore.addFields('Subscription', () =>
        options.fields!(new SubscriptionFieldBuilder(this, this.fieldMode)),
      );
    }

    return ref;
  }

  subscriptionFields(fields: SubscriptionFieldsShape<Types>) {
    this.configStore.addFields('Subscription', () =>
      fields(new SubscriptionFieldBuilder(this, this.fieldMode)),
    );
  }

  subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
    this.configStore.addFields('Subscription', () => ({
      [name]: field(new SubscriptionFieldBuilder(this, this.fieldMode)),
    }));
  }

  args<Shape extends InputFieldMap>(
    fields: (t: PothosSchemaTypes.InputFieldBuilder<Types, 'Arg'>) => Shape,
  ): Shape {
    return fields(new InputFieldBuilder<Types, 'Arg'>(this, 'Arg'));
  }

  interfaceType<
    Param extends InterfaceParam<Types>,
    Interfaces extends InterfaceParam<Types>[],
    ResolveType,
  >(
    param: Param,
    options: InterfaceTypeOptions<Types, Param, ParentShape<Types, Param>, Interfaces, ResolveType>,
    fields?: InterfaceFieldsShape<Types, ParentShape<Types, Param>>,
  ): PothosSchemaTypes.InterfaceRef<
    Types,
    AbstractReturnShape<Types, Param, ResolveType>,
    ParentShape<Types, Param>
  > {
    verifyRef(param);
    verifyInterfaces(options.interfaces);

    const name =
      typeof param === 'string'
        ? param
        : (options as { name?: string }).name ?? (param as { name: string }).name;

    const ref =
      param instanceof BaseTypeRef
        ? (param as InterfaceRef<
            Types,
            AbstractReturnShape<Types, Param, ResolveType>,
            ParentShape<Types, Param>
          >)
        : new InterfaceRef<
            Types,
            AbstractReturnShape<Types, Param, ResolveType>,
            ParentShape<Types, Param>
          >(name);

    const typename = ref.name;

    ref.updateConfig({
      kind: 'Interface',
      graphqlKind: 'Interface',
      name: typename,
      interfaces: [],
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.InterfaceTypeOptions,
      extensions: options.extensions,
      resolveType: options.resolveType as GraphQLTypeResolver<unknown, unknown>,
    });

    this.configStore.addTypeRef(ref);

    if (options.interfaces) {
      ref.addInterfaces(options.interfaces);
    }

    if (ref !== param && typeof param !== 'string') {
      this.configStore.associateParamWithRef(param, ref);
    }

    if (fields) {
      this.configStore.addFields(ref, () =>
        fields(new InterfaceFieldBuilder(this, this.fieldMode)),
      );
    }

    if (options.fields) {
      this.configStore.addFields(ref, () =>
        options.fields!(new InterfaceFieldBuilder(this, this.fieldMode)),
      );
    }

    return ref;
  }

  interfaceFields<Type extends InterfaceParam<Types>>(
    ref: Type,
    fields: InterfaceFieldsShape<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(ref);

    this.configStore.addFields(ref, () => fields(new InterfaceFieldBuilder(this, this.fieldMode)));
  }

  interfaceField<Type extends InterfaceParam<Types>>(
    ref: Type,
    fieldName: string,
    field: InterfaceFieldThunk<Types, ParentShape<Types, Type>>,
  ) {
    verifyRef(ref);

    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new InterfaceFieldBuilder(this, this.fieldMode)),
    }));
  }

  unionType<Member extends ObjectParam<Types>, ResolveType>(
    name: string,
    options: PothosSchemaTypes.UnionTypeOptions<Types, Member, ResolveType>,
  ): PothosSchemaTypes.UnionRef<
    Types,
    AbstractReturnShape<Types, Member, ResolveType>,
    ParentShape<Types, Member>
  > {
    const ref = new UnionRef<
      Types,
      AbstractReturnShape<Types, Member, ResolveType>,
      ParentShape<Types, Member>
    >(name, {
      kind: 'Union',
      graphqlKind: 'Union',
      name,
      types: [],
      description: options.description,
      resolveType: options.resolveType as GraphQLTypeResolver<unknown, object>,
      pothosOptions: options as unknown as PothosSchemaTypes.UnionTypeOptions,
      extensions: options.extensions,
    });

    if (Array.isArray(options.types)) {
      options.types.forEach((type) => {
        verifyRef(type);
      });
    }

    this.configStore.addTypeRef(ref);
    ref.addTypes(options.types);

    return ref;
  }

  enumType<Param extends EnumParam, Values extends EnumValues<Types>>(
    param: Param,
    options: EnumTypeOptions<Types, Param, Values>,
  ): PothosSchemaTypes.EnumRef<
    Types,
    Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>
  > {
    verifyRef(param);
    const name = typeof param === 'string' ? param : (options as { name: string }).name;

    const values =
      typeof param === 'object'
        ? valuesFromEnum<Types>(
            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion
            param as BaseEnum,
            options?.values as Record<string, PothosSchemaTypes.EnumValueConfig<Types>>,
          )
        : normalizeEnumValues<Types>((options as { values: EnumValues<Types> }).values);

    const ref = new EnumRef<
      Types,
      Param extends BaseEnum ? ValuesFromEnum<Param> : ShapeFromEnumValues<Types, Values>
    >(name, {
      kind: 'Enum',
      graphqlKind: 'Enum',
      name,
      values,
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.EnumTypeOptions<Types>,
      extensions: options.extensions,
    });

    this.configStore.addTypeRef(ref);

    if (typeof param !== 'string') {
      this.configStore.associateParamWithRef(param as ConfigurableRef<Types>, ref);
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
  ): PothosSchemaTypes.ScalarRef<Types, InputShape<Types, Name>, ParentShape<Types, Name>> {
    const ref = new ScalarRef<Types, InputShape<Types, Name>, ParentShape<Types, Name>>(name, {
      kind: 'Scalar',
      graphqlKind: 'Scalar',
      name,
      description: options.description,
      parseLiteral: options.parseLiteral,
      parseValue: options.parseValue,
      serialize: options.serialize as GraphQLScalarSerializer<OutputShape<Types, Name>>,
      pothosOptions: options as unknown as PothosSchemaTypes.ScalarTypeOptions,
      extensions: options.extensions,
    });

    this.configStore.addTypeRef(ref);

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
    Param extends InputObjectRef<Types, unknown> | string,
    Fields extends Param extends PothosSchemaTypes.InputObjectRef<Types, unknown>
      ? InputFieldsFromShape<Types, InputShape<Types, Param> & object, 'InputObject'>
      : Param extends keyof Types['Inputs']
        ? InputFieldsFromShape<Types, InputShape<Types, Param> & object, 'InputObject'>
        : InputFieldMap,
  >(
    param: Param,
    options: PothosSchemaTypes.InputObjectTypeOptions<Types, Fields>,
  ): PothosSchemaTypes.InputObjectRef<Types, InputShapeFromFields<Fields>> {
    verifyRef(param);
    const name = typeof param === 'string' ? param : (param as { name: string }).name;

    const ref = (
      typeof param === 'string'
        ? new InputObjectRef<Types, InputShapeFromFields<Fields>>(name)
        : param
    ) as PothosSchemaTypes.InputObjectRef<Types, InputShapeFromFields<Fields>>;

    ref.updateConfig({
      kind: 'InputObject',
      graphqlKind: 'InputObject',
      name,
      isOneOf: options.isOneOf,
      description: options.description,
      pothosOptions: options as unknown as PothosSchemaTypes.InputObjectTypeOptions,
      extensions: options.extensions,
    } as PothosInputObjectTypeConfig & { isOneOf?: boolean });

    this.configStore.addTypeRef(ref);

    if (param !== ref && typeof param !== 'string') {
      this.configStore.associateParamWithRef(param as ConfigurableRef<Types>, ref);
    }

    this.configStore.addInputFields(ref, () =>
      options.fields(new InputFieldBuilder(this, 'InputObject')),
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
      if (!this.configStore.hasImplementation(scalar.name)) {
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

  createFieldRef<
    Parent,
    Type extends TypeParam<Types>,
    Nullable extends FieldNullability<Type>,
    Args extends InputFieldMap,
    Kind extends FieldKind,
    ResolveShape,
    ResolveReturnShape,
    Mode extends FieldMode,
  >(
    mode: Mode,
    kind: FieldKind,
    type: TypeParam<Types> | undefined,
    options: FieldOptionsFromKind<
      Types,
      Parent,
      Type,
      Nullable,
      Args,
      Kind,
      ResolveShape,
      ResolveReturnShape,
      Mode
    >,
    extra: (name: string) => Partial<PothosOutputFieldConfig<Types>> = () => ({}),
  ): FieldRefFromMode<
    Types,
    Parent,
    Type,
    Nullable,
    Args,
    ResolveShape,
    ResolveReturnShape,
    Kind,
    Mode
  > {
    const normalizer = SchemaBuilder.fieldOptionNormalizers[mode];

    if (!normalizer) {
      throw new PothosError(`No field option normalizer found for mode ${mode}`);
    }

    const ref = new FieldRef<Types>(kind, (name, typeConfig) => {
      const args: Record<string, PothosInputFieldConfig<Types>> = {};
      const { extensions, ...normalized } = normalizer(
        this as never,
        name,
        options as never,
        type as never,
      );
      const { extensions: extraExtensions, ...extraConfig } = extra(name);

      for (const [argName, arg] of Object.entries(normalized.args ?? {})) {
        args[argName] = arg.getConfig(argName, name, typeConfig);
      }

      return {
        ...normalized,
        ...extraConfig,
        extensions: {
          ...extensions,
          ...extraExtensions,
        },
        kind: kind as never,
        graphqlKind: typeConfig.graphqlKind as never,
        parentType: typeConfig.name,
        pothosOptions: options as never,
        name,
        args,
      } satisfies Partial<PothosOutputFieldConfig<Types>> as never;
    });

    return ref as never;
  }
}
