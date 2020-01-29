import {
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLString,
  GraphQLInt,
  GraphQLID,
  GraphQLFloat,
  GraphQLBoolean,
  GraphQLDirective,
} from 'graphql';
import {
  ImplementedType,
  EnumValues,
  InputFields,
  InputShapeFromFields,
  ShapedInputFields,
  MergeTypeMap,
  DefaultTypeMap,
  NullableToOptional,
  ObjectName,
  InterfaceName,
  ScalarName,
  InputName,
  FieldsShape,
  RootFieldsShape,
  ResolverMap,
  ShapeFromTypeParam,
  CompatibleInterfaceParam,
} from './types';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import InputFieldBuilder from './fieldUtils/input';
import BasePlugin from './plugin';
import BuildCache from './build-cache';
import RootType from './graphql/root';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';

export default class SchemaBuilder<
  PartialTypes extends GiraphQLSchemaTypes.PartialTypeInfo = {},
  Types extends MergeTypeMap<DefaultTypeMap, PartialTypes> = MergeTypeMap<
    DefaultTypeMap,
    PartialTypes
  >
> {
  private plugins: BasePlugin<Types>[];

  private types: ImplementedType<Types>[] = [];

  private fields: (FieldSet<Types, any> | RootFieldSet<Types, any>)[] = [];

  private stateful: boolean;

  constructor(options: { plugins?: BasePlugin<Types>[]; stateful?: boolean } = {}) {
    this.plugins = options.plugins ?? [];
    this.stateful = options.stateful ?? false;
  }

  scalars = {
    ID: this.createScalar('ID', GraphQLID),
    Int: this.createScalar('Int', GraphQLInt),
    Float: this.createScalar('Float', GraphQLFloat),
    String: this.createScalar('String', GraphQLString),
    Boolean: this.createScalar('Boolean', GraphQLBoolean),
  };

  createObjectType<
    Interfaces extends CompatibleInterfaceParam<Types, ShapeFromTypeParam<Types, Type, false>>[],
    Type extends ObjectName<Types>
  >(
    name: Type,
    options: NullableToOptional<
      GiraphQLSchemaTypes.ObjectTypeOptions<
        Interfaces,
        Types,
        ShapeFromTypeParam<Types, Type, false>
      >
    >,
  ) {
    return this.addType(new ObjectType<Interfaces, Types, Type>(name, options));
  }

  createObjectFields<Type extends ObjectName<Types>>(
    name: Type,
    shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>>,
  ) {
    return this.addFields(new FieldSet(name, shape));
  }

  createQueryType(options: GiraphQLSchemaTypes.QueryTypeOptions<Types>) {
    return this.addType(new RootType<Types, 'Query'>('Query', options));
  }

  createQueryFields(shape: RootFieldsShape<Types, 'Query'>) {
    return this.addFields(new RootFieldSet('Query', shape));
  }

  createMutationType(options: GiraphQLSchemaTypes.MutationTypeOptions<Types>) {
    return this.addType(new RootType<Types, 'Mutation'>('Mutation', options));
  }

  createMutationFields(shape: RootFieldsShape<Types, 'Mutation'>) {
    return this.addFields(new RootFieldSet('Mutation', shape));
  }

  createSubscriptionType(options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>) {
    return this.addType(new RootType<Types, 'Subscription'>('Subscription', options));
  }

  createSubscriptionFields(shape: RootFieldsShape<Types, 'Subscription'>) {
    return this.addFields(new RootFieldSet('Subscription', shape));
  }

  createArgs<Shape extends InputFields<Types>>(shape: (t: InputFieldBuilder<Types>) => Shape) {
    return shape(new InputFieldBuilder<Types>());
  }

  createInterfaceType<Type extends InterfaceName<Types>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<
      Types,
      ShapeFromTypeParam<Types, Type, false>
    >,
  ) {
    return this.addType(new InterfaceType<Types, Type>(name, options));
  }

  createInterfaceFields<Type extends InterfaceName<Types>>(
    name: Type,
    shape: FieldsShape<Types, ShapeFromTypeParam<Types, Type, false>>,
  ) {
    return this.addFields(new FieldSet(name, shape));
  }

  createUnionType<Member extends ObjectName<Types>, Name extends string>(
    name: Name,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    return this.addType(new UnionType<Types, Name, Member>(name, options));
  }

  createEnumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: GiraphQLSchemaTypes.EnumTypeOptions<Values>,
  ) {
    return this.addType(new EnumType(name, options));
  }

  createScalar<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType) {
    return this.addType(new ScalarType<Types, Name>(name, scalar));
  }

  createInputType<
    Name extends string,
    Fields extends Name extends InputName<Types>
      ? ShapedInputFields<Types, Types['Input'][Name]>
      : InputFields<Types>,
    Shape extends Name extends InputName<Types>
      ? Types['Input'][Name]
      : InputShapeFromFields<Types, Fields>
  >(name: Name, options: GiraphQLSchemaTypes.InputTypeOptions<Types, Fields>) {
    return this.addType(
      new InputObjectType<
        Types,
        Shape,
        Fields,
        Name,
        InputShapeFromFields<Types, Fields, undefined>
      >(name, options),
    );
  }

  toSchema(
    types?: ImplementedType<Types>[],
    {
      fieldDefinitions,
      directives,
      extensions,
      mocks,
    }: {
      directives?: readonly GraphQLDirective[];
      extensions?: Record<string, unknown>;
      fieldDefinitions?: (FieldSet<Types, any> | RootFieldSet<Types, any>)[];
      mocks?: ResolverMap;
    } = {},
  ) {
    const scalars = [
      this.scalars.Boolean,
      this.scalars.Float,
      this.scalars.ID,
      this.scalars.Int,
      this.scalars.String,
    ];

    const buildCache = new BuildCache<Types>([...scalars, ...this.types, ...(types ?? [])], {
      plugins: this.plugins,
      fieldDefinitions: [...this.fields, ...(fieldDefinitions ?? [])],
      mocks,
    });

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()].map(entry => entry.built);

    const schema = new GraphQLSchema({
      query: buildCache.has('Query') ? buildCache.getEntryOfType('Query', 'Root').built : undefined,
      mutation: buildCache.has('Mutation')
        ? buildCache.getEntryOfType('Mutation', 'Root').built
        : undefined,
      subscription: buildCache.has('Subscription')
        ? buildCache.getEntryOfType('Subscription', 'Root').built
        : undefined,
      extensions,
      directives: directives as GraphQLDirective[],
      types: builtTypes,
    });

    return schema;
  }

  private addType<T extends ImplementedType<Types>>(type: T) {
    if (this.stateful) {
      this.types.push(type);
    }

    return type;
  }

  private addFields<T extends FieldSet<Types, any> | RootFieldSet<Types, any>>(fields: T) {
    if (this.stateful) {
      this.fields.push(fields);
    }

    return fields;
  }
}
