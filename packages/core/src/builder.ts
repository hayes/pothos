/* eslint-disable no-dupe-class-members */
import {
  GraphQLEnumValueConfigMap,
  GraphQLScalarType,
  GraphQLDirective,
  GraphQLSchema,
  GraphQLIsTypeOfFn,
} from 'graphql';
import {
  EnumValues,
  InputFields,
  CompatibleInterfaceParam,
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
} from '.';
import { BasePlugin, mergePlugins } from './plugins';
import ConfigStore from './config-store';
import InterfaceRef from './refs/interface';
import UnionRef from './refs/union';
import EnumRef from './refs/enum';
import ScalarRef from './refs/scalar';
import ObjectRef from './refs/object';

export default class SchemaBuilder<Types extends SchemaTypes> {
  private plugin: Required<BasePlugin>;

  private configStore: ConfigStore<Types>;

  constructor(options: { plugins?: BasePlugin[] } = {}) {
    this.plugin = mergePlugins(options.plugins ?? []);
    this.configStore = new ConfigStore<Types>(this.plugin);
  }

  objectType<
    Interfaces extends CompatibleInterfaceParam<Types, OutputShape<Type>>[],
    Type extends Types['objects'] & keyof Types['outputShapes']
  >(
    name: Type,
    options:
      | GiraphQLSchemaTypes.ObjectTypeOptions<Types, OutputShape<Type>>
      | GiraphQLSchemaTypes.ObjectTypeWithInterfaceOptions<Types, OutputShape<Type>, Interfaces>,
    shape?: ObjectFieldsShape<Types, OutputShape<Type>>,
  ) {
    const ref = new ObjectRef<Type>(name);
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

    return ref;
  }

  objectFields<Type extends ObjectParam<Types>>(
    ref: Type,
    shape: ObjectFieldsShape<Types, OutputShape<Type>>,
  ) {
    this.configStore.addFields(ref, () =>
      shape(new ObjectFieldBuilder(this.configStore.getNameFromRef(ref))),
    );
  }

  objectField<Type extends ObjectParam<Types>>(
    ref: Type,
    fieldName: string,
    field: ObjectFieldThunk<Types, OutputShape<Type>>,
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

  args<Shape extends InputFields<Types>>(
    shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Shape,
  ) {
    return shape(new InputFieldBuilder<Types>());
  }

  interfaceType<Type extends InterfaceParam<Types>>(
    nameOrRef: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, OutputShape<Type>>,
    shape?: InterfaceFieldsShape<Types, OutputShape<Type>>,
  ) {
    const ref =
      typeof nameOrRef === 'string'
        ? new InterfaceRef<Type>(nameOrRef)
        : (nameOrRef as InterfaceRef<OutputShape<Type>>);

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
    shape: InterfaceFieldsShape<Types, OutputShape<Type>>,
  ) {
    this.configStore.addFields(ref, () =>
      shape(new InterfaceFieldBuilder(this.configStore.getNameFromRef(ref))),
    );
  }

  interfaceField<Type extends InterfaceParam<Types>>(
    ref: Type,
    fieldName: string,
    field: InterfaceFieldThunk<Types, OutputShape<Type>>,
  ) {
    this.configStore.addFields(ref, () => ({
      [fieldName]: field(new InterfaceFieldBuilder(this.configStore.getNameFromRef(ref))),
    }));
  }

  unionType<Member extends ObjectParam<Types>>(
    name: string,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    const ref = new UnionRef<Member>(name);
    this.configStore.associateRefWithName(ref, name);

    this.configStore.addInterfaceConfig({
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

    const values: GraphQLEnumValueConfigMap = {};

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

  // inputType<Name extends string, Fields extends InputFields<Types>>(
  //   name: Name,
  //   options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  // ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>;

  // inputType<Name extends string, Fields extends InputFields<Types>>(
  //   name: Name,
  //   options: Omit<GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>, 'shape'>,
  //   shape: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Fields,
  // ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>;

  // inputType<Name extends string, Fields extends InputFields<Types>>(
  //   name: Name,
  //   options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>,
  //   shape?: (t: GiraphQLSchemaTypes.InputFieldBuilder<Types>) => Fields,
  // ): InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name> {
  //   if (shape && options.shape) {
  //     throw new Error(`Received multiple field shape functions for InputObjectType ${name}`);
  //   }

  //   return this.addType(
  //     new InputObjectType<Types, InputShapeFromFields<Types, Fields, undefined>, Name>(name, {
  //       ...options,
  //       shape: shape ?? options.shape,
  //     }),
  //   );
  // }

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

    console.log(buildCache);

    // buildCache.buildAll();

    // const builtTypes = [...buildCache.types.values()].map((entry) => entry.built);

    const schema = new GraphQLSchema({
      query: undefined,
      // query: buildCache.has('Query')
      //   ? buildCache.getEntryOfType('Query', 'Query').built
      //   : undefined,
      // mutation: buildCache.has('Mutation')
      //   ? buildCache.getEntryOfType('Mutation', 'Mutation').built
      //   : undefined,
      // subscription: buildCache.has('Subscription')
      //   ? buildCache.getEntryOfType('Subscription', 'Subscription').built
      //   : undefined,
      // extensions,
      // directives: directives as GraphQLDirective[],
      // types: builtTypes,
    });

    this.plugin.afterBuild(schema, this);

    return schema;
  }
}
