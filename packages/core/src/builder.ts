import {
  GraphQLScalarType,
  GraphQLDirective,
  GraphQLSchema,
  GraphQLIsTypeOfFn,
  GraphQLObjectType,
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
} from '.';
import { BasePlugin, mergePlugins } from './plugins';
import ConfigStore from './config-store';
import InterfaceRef from './refs/interface';
import UnionRef from './refs/union';
import EnumRef from './refs/enum';
import ScalarRef from './refs/scalar';
import ObjectRef from './refs/object';
import { normalizeEnumValues } from './utils';
import InputObjectRef from './refs/input';

export default class SchemaBuilder<Types extends SchemaTypes> {
  private plugin: Required<BasePlugin>;

  private configStore: ConfigStore<Types>;

  constructor(options: { plugins?: BasePlugin[] } = {}) {
    this.plugin = mergePlugins(options.plugins ?? []);
    this.configStore = new ConfigStore<Types>(this.plugin);
  }

  objectType<Interfaces extends InterfaceParam<Types>[], Type extends Types['objects']>(
    name: Type,
    options:
      | GiraphQLSchemaTypes.ObjectTypeOptions<Types, OutputShape<Type, Types>>
      | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<
          Types,
          OutputShape<Type, Types>,
          Interfaces
        >,
    shape?: ObjectFieldsShape<Types, OutputShape<Type, Types>>,
  ) {
    const ref = new ObjectRef<OutputShape<Type, Types>>(name);
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
      this.configStore.addFields(ref, () => shape(new ObjectFieldBuilder(name)));
    }

    if (options.shape) {
      this.configStore.addFields(ref, () => options.shape!(new ObjectFieldBuilder(name)));
    }

    if (options.implements) {
      this.configStore.setImplementedInterfaces(name, options.implements);
    }

    return ref;
  }

  objectFields<Type extends ObjectParam<Types>>(
    ref: Type,
    shape: ObjectFieldsShape<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () =>
      shape(new ObjectFieldBuilder(this.configStore.getNameFromRef(ref))),
    );
  }

  objectField<Type extends ObjectParam<Types>>(
    ref: Type,
    fieldName: string,
    field: ObjectFieldThunk<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new ObjectFieldBuilder(this.configStore.getNameFromRef(ref))),
    }));
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
      this.configStore.addFields('Query', () => shape(new QueryFieldBuilder()));
    }

    if (options.shape) {
      this.configStore.addFields('Query', () => options.shape!(new QueryFieldBuilder()));
    }
  }

  queryFields(shape: QueryFieldsShape<Types>) {
    this.configStore.addFields('Query', () => shape(new QueryFieldBuilder()));
  }

  queryField(name: string, field: QueryFieldThunk<Types>) {
    this.configStore.addFields('Query', () => ({ [name]: field(new QueryFieldBuilder()) }));
  }

  mutationType(
    options: GiraphQLSchemaTypes.MutationTypeOptions<Types>,
    shape?: MutationFieldsShape<Types>,
  ) {
    this.configStore.addObjectConfig({
      name: 'Mutation',
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    if (shape) {
      this.configStore.addFields('Mutation', () => shape(new MutationFieldBuilder()));
    }

    if (options.shape) {
      this.configStore.addFields('Mutation', () => options.shape!(new MutationFieldBuilder()));
    }
  }

  mutationFields(shape: MutationFieldsShape<Types>) {
    this.configStore.addFields('Mutation', () => shape(new MutationFieldBuilder()));
  }

  mutationField(name: string, field: MutationFieldThunk<Types>) {
    this.configStore.addFields('Mutation', () => ({ [name]: field(new MutationFieldBuilder()) }));
  }

  subscriptionType(
    options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>,
    shape?: SubscriptionFieldsShape<Types>,
  ) {
    this.configStore.addObjectConfig({
      name: 'Subscription',
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    if (shape) {
      this.configStore.addFields('Subscription', () => shape(new SubscriptionFieldBuilder()));
    }

    if (options.shape) {
      this.configStore.addFields('Subscription', () =>
        options.shape!(new SubscriptionFieldBuilder()),
      );
    }
  }

  subscriptionFields(shape: SubscriptionFieldsShape<Types>) {
    this.configStore.addFields('Subscription', () => shape(new SubscriptionFieldBuilder()));
  }

  subscriptionField(name: string, field: SubscriptionFieldThunk<Types>) {
    this.configStore.addFields('Subscription', () => ({
      [name]: field(new SubscriptionFieldBuilder()),
    }));
  }

  args<Shape extends InputFields>(
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Shape,
  ) {
    return shape(new InputFieldBuilder<Types>());
  }

  interfaceType<Type extends Types['interfaces']>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, OutputShape<Type, Types>>,
    shape?: InterfaceFieldsShape<Types, OutputShape<Type, Types>>,
  ) {
    const ref = new InterfaceRef<OutputShape<Type, Types>>(name);

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

    if (shape) {
      this.configStore.addFields(ref, () => shape(new InterfaceFieldBuilder(typename)));
    }

    if (options.shape) {
      this.configStore.addFields(ref, () => options.shape!(new InterfaceFieldBuilder(typename)));
    }

    return ref;
  }

  interfaceFields<Type extends InterfaceParam<Types>>(
    ref: Type,
    shape: InterfaceFieldsShape<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () =>
      shape(new InterfaceFieldBuilder(this.configStore.getNameFromRef(ref))),
    );
  }

  interfaceField<Type extends InterfaceParam<Types>>(
    ref: Type,
    fieldName: string,
    field: InterfaceFieldThunk<Types, OutputShape<Type, Types>>,
  ) {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new InterfaceFieldBuilder(this.configStore.getNameFromRef(ref))),
    }));
  }

  unionType<Member extends ObjectParam<Types>>(
    name: string,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    const ref = new UnionRef<OutputShape<Member, Types>>(name);
    this.configStore.associateRefWithName(ref, name);

    this.configStore.addUnionMembers(name, options.members);

    this.configStore.addUnionConfig({
      name,
      description: options.description,
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
    options: GiraphQLSchemaTypes.ScalarOptions<InputShape<Name, Types>, OutputShape<Name, Types>>,
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

  inputType<Name extends string, Fields extends InputFields>(
    name: Name,
    options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  ): InputObjectRef<InputShapeFromFields<Fields>> {
    const ref = new InputObjectRef<InputShapeFromFields<Fields>>(name);

    this.configStore.associateRefWithName(ref, name);

    this.configStore.addInputConfig({
      name,
      description: options.description,
      extensions: {
        ...options.extensions,
        giraphqlOptions: options,
      },
    });

    this.configStore.addInputFields(ref, () => options.shape(new InputFieldBuilder()));

    return ref;
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
