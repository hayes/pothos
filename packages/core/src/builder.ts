import {
  GraphQLScalarType,
  GraphQLDirective,
  GraphQLSchema,
  GraphQLIsTypeOfFn,
  GraphQLObjectType,
  GraphQLTypeResolver,
} from 'graphql';
import {
  EnumValues,
  InputFields,
  ObjectFieldsShape,
  QueryFieldsShape,
  MutationFieldsShape,
  SubscriptionFieldsShape,
  InterfaceFieldsShape,
  ObjectFieldThunk,
  InterfaceFieldThunk,
  QueryFieldThunk,
  MutationFieldThunk,
  SubscriptionFieldThunk,
  SchemaTypes,
  OutputShape,
  InputShape,
  ObjectParam,
  InterfaceParam,
  ShapeFromEnumValues,
  ScalarName,
  ResolverMap,
} from './types';
import BuildCache from './build-cache';
import {
  InputFieldBuilder,
  ObjectFieldBuilder,
  QueryFieldBuilder,
  MutationFieldBuilder,
  SubscriptionFieldBuilder,
  InterfaceFieldBuilder,
  InputShapeFromFields,
  ObjectTypeOptions,
} from '.';
import { BasePlugin, mergePlugins } from './plugins';
import ConfigStore from './config-store';
import InterfaceRef from './refs/interface';
import UnionRef from './refs/union';
import EnumRef from './refs/enum';
import ScalarRef from './refs/scalar';
import ObjectRef from './refs/object';
import { normalizeEnumValues } from './utils';
import InputObjectRef, { ImplementableInputObjectRef } from './refs/input';

export default class SchemaBuilder<Types extends SchemaTypes> {
  private plugin: Required<BasePlugin>;

  private configStore: ConfigStore<Types>;

  constructor(options: { plugins?: BasePlugin[] } = {}) {
    this.plugin = mergePlugins(options.plugins ?? []);
    this.configStore = new ConfigStore<Types>(this.plugin);
  }

  objectType<Interfaces extends InterfaceParam<Types>[], Param extends ObjectParam<Types>>(
    param: Param,
    options: ObjectTypeOptions<Types, OutputShape<Param, Types>, Interfaces>,
    shape?: ObjectFieldsShape<Types, OutputShape<Param, Types>>,
  ) {
    const name = typeof param === 'string' ? param : (param as { name: string }).name;

    if (name === 'Query' || name === 'Mutation' || name === 'Subscription') {
      throw new Error(`Invalid object name ${name} use .create${name}Type() instead`);
    }

    const ref: ObjectRef<OutputShape<Param, Types>> =
      param instanceof ObjectRef ? param : new ObjectRef<OutputShape<Param, Types>>(name);

    this.configStore.associateRefWithName(ref, name);

    this.configStore.addObjectConfig({
      name,
      description: options.description,
      isTypeOf: options.isType as GraphQLIsTypeOfFn<unknown, Types['context']>,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    if (shape) {
      this.configStore.addFields(ref, () => shape(new ObjectFieldBuilder(name, this)));
    }

    if (options.fields) {
      this.configStore.addFields(ref, () => options.fields!(new ObjectFieldBuilder(name, this)));
    }

    if (options.interfaces) {
      this.configStore.setImplementedInterfaces(name, options.interfaces);
    }

    return ref;
  }

  objectFields<Type extends ObjectParam<Types>>(
    ref: Type,
    fields: ObjectFieldsShape<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () =>
      fields(new ObjectFieldBuilder(this.configStore.getNameFromRef(ref), this)),
    );
  }

  objectField<Type extends ObjectParam<Types>>(
    ref: Type,
    fieldName: string,
    field: ObjectFieldThunk<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new ObjectFieldBuilder(this.configStore.getNameFromRef(ref), this)),
    }));
  }

  objectRef<T>(name: string) {
    return new ObjectRef<T>(name);
  }

  queryType(options: GiraphQLSchemaTypes.QueryTypeOptions<Types>, shape?: QueryFieldsShape<Types>) {
    this.configStore.addObjectConfig({
      name: 'Query',
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    if (shape) {
      this.configStore.addFields('Query', () => shape(new QueryFieldBuilder(this)));
    }

    if (options.fields) {
      this.configStore.addFields('Query', () => options.fields!(new QueryFieldBuilder(this)));
    }
  }

  queryFields(fields: QueryFieldsShape<Types>) {
    this.configStore.addFields('Query', () => fields(new QueryFieldBuilder(this)));
  }

  queryField(name: string, field: QueryFieldThunk<Types>) {
    this.configStore.addFields('Query', () => ({ [name]: field(new QueryFieldBuilder(this)) }));
  }

  mutationType(
    options: GiraphQLSchemaTypes.MutationTypeOptions<Types>,
    fields?: MutationFieldsShape<Types>,
  ) {
    this.configStore.addObjectConfig({
      name: 'Mutation',
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

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
    options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>,
    fields?: SubscriptionFieldsShape<Types>,
  ) {
    this.configStore.addObjectConfig({
      name: 'Subscription',
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

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

  args<Shape extends InputFields>(
    fields: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Shape,
  ): Shape {
    return fields(new InputFieldBuilder<Types>(this));
  }

  interfaceType<Param extends InterfaceParam<Types>>(
    param: Param,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, OutputShape<Param, Types>>,
    fields?: InterfaceFieldsShape<Types, OutputShape<Param, Types>>,
  ) {
    const name = typeof param === 'string' ? param : (param as { name: string }).name;
    const ref: InterfaceRef<OutputShape<Param, Types>> =
      param instanceof InterfaceRef ? param : new InterfaceRef<OutputShape<Param, Types>>(name);

    const typename = ref.name;

    this.configStore.addInterfaceConfig({
      name: typename,
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    this.configStore.associateRefWithName(ref, typename);

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
    fields: InterfaceFieldsShape<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () =>
      fields(new InterfaceFieldBuilder(this.configStore.getNameFromRef(ref), this)),
    );
  }

  interfaceField<Type extends InterfaceParam<Types>>(
    ref: Type,
    fieldName: string,
    field: InterfaceFieldThunk<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new InterfaceFieldBuilder(this.configStore.getNameFromRef(ref), this)),
    }));
  }

  interfaceRef<T>(name: string) {
    return new InterfaceRef<T>(name);
  }

  unionType<Member extends ObjectParam<Types>>(
    name: string,
    options: GiraphQLSchemaTypes.UnionTypeOptions<Types, Member>,
  ) {
    const ref = new UnionRef<OutputShape<Member, Types>>(name);
    this.configStore.associateRefWithName(ref, name);

    this.configStore.addUnionMembers(name, options.members);

    this.configStore.addUnionConfig({
      name,
      description: options.description,
      resolveType: options.resolveType as GraphQLTypeResolver<unknown, object>,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    return ref;
  }

  enumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: GiraphQLSchemaTypes.EnumTypeOptions<Values>,
  ) {
    const ref = new EnumRef<ShapeFromEnumValues<Values>>(name);
    this.configStore.associateRefWithName(ref, name);

    const values = normalizeEnumValues(options);

    this.configStore.addEnumConfig({
      name,
      values,
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    return ref;
  }

  scalarType<Name extends ScalarName<Types>>(
    name: Name,
    options: GiraphQLSchemaTypes.ScalarTypeOptions<
      InputShape<Name, Types>,
      OutputShape<Name, Types>
    >,
  ) {
    const ref = new ScalarRef<InputShape<Name, Types>, OutputShape<Name, Types>>(name);

    this.configStore.associateRefWithName(ref, name);

    this.configStore.addScalarConfig({
      name,
      description: options.description,
      parseLiteral: options.parseLiteral,
      parseValue: options.parseValue,
      serialize: options.serialize,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    return ref;
  }

  addScalarType<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType) {
    const ref = new ScalarRef<InputShape<Name, Types>, OutputShape<Name, Types>>(name);
    const config = scalar.toConfig();

    this.configStore.associateRefWithName(ref, name);

    this.configStore.addScalarConfig({
      ...config,
      name,
      extensions: {
        ...config.extensions,
        giraphqlOptions: {},
      },
    });

    return ref;
  }

  inputType<Param extends string | InputObjectRef<unknown>, Fields extends InputFields>(
    param: Param,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  ): InputObjectRef<InputShapeFromFields<Fields>> {
    const name = typeof param === 'string' ? param : (param as { name: string }).name;

    const ref: InputObjectRef<InputShapeFromFields<Fields>> =
      param instanceof InputObjectRef
        ? param
        : new InputObjectRef<InputShapeFromFields<Fields>>(name);

    this.configStore.associateRefWithName(ref, name);

    this.configStore.addInputConfig({
      name,
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    this.configStore.addInputFields(ref, () => options.fields(new InputFieldBuilder(this)));

    return ref;
  }

  inputRef<T extends object>(name: string): ImplementableInputObjectRef<Types, T> {
    return new ImplementableInputObjectRef<Types, T>(this, name);
  }

  toSchema({
    directives,
    extensions,
    mocks,
  }: {
    directives?: readonly GraphQLDirective[];
    extensions?: Record<string, unknown>;
    mocks?: ResolverMap;
  } = {}) {
    this.configStore.buildPendingFields();

    this.plugin.beforeBuild(this);

    const buildCache = new BuildCache(this.configStore, this.plugin, {
      mocks,
    });

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()];

    const schema = new GraphQLSchema({
      query: buildCache.types.get('Query') as GraphQLObjectType | undefined,
      mutation: buildCache.types.get('Mutation') as GraphQLObjectType | undefined,
      subscription: buildCache.types.get('Subscription') as GraphQLObjectType | undefined,
      extensions,
      directives: directives as GraphQLDirective[],
      types: builtTypes,
    });

    this.plugin.afterBuild(schema, this);

    return schema;
  }
}
