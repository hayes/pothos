/* eslint-disable no-restricted-syntax */
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
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
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
  TypeParam,
  RootName,
} from './types';
import ObjectType from './graphql/object';
import UnionType from './graphql/union';
import InputObjectType from './graphql/input';
import InterfaceType from './graphql/interface';
import EnumType from './graphql/enum';
import ScalarType from './graphql/scalar';
import InputFieldBuilder from './fieldUtils/input';
import BasePlugin from './plugin';
import Field from './graphql/field';
import BuildCache from './build-cache';
import FieldBuilder from './fieldUtils/builder';
import RootFieldBuilder from './fieldUtils/root';
import RootType from './graphql/root';
import FieldSet from './graphql/field-set';
import RootFieldSet from './graphql/root-field-set';

export * from './types';

export {
  BasePlugin,
  Field,
  BuildCache,
  ObjectType,
  InterfaceType,
  UnionType,
  EnumType,
  ScalarType,
  InputObjectType,
  FieldBuilder,
  InputFieldBuilder,
  RootType,
  RootFieldBuilder,
};

export default class SchemaBuilder<
  PartialTypes extends GiraphQLSchemaTypes.PartialTypeInfo = {},
  Types extends MergeTypeMap<DefaultTypeMap, PartialTypes> = MergeTypeMap<
    DefaultTypeMap,
    PartialTypes
  >
> {
  plugins: BasePlugin<Types>[];

  constructor(options: { plugins?: BasePlugin<Types>[] } = {}) {
    this.plugins = options.plugins || [];
  }

  scalars = {
    ID: this.createScalar('ID', GraphQLID),
    Int: this.createScalar('Int', GraphQLInt),
    Float: this.createScalar('Float', GraphQLFloat),
    String: this.createScalar('String', GraphQLString),
    Boolean: this.createScalar('Boolean', GraphQLBoolean),
  };

  createObjectType<
    Interfaces extends InterfaceType<
      {},
      Types,
      CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, false>>
    >[],
    Type extends ObjectName<Types>
  >(
    name: Type,
    options: NullableToOptional<GiraphQLSchemaTypes.ObjectTypeOptions<Interfaces, Types, Type>>,
  ) {
    return new ObjectType<Interfaces, Types, Type>(name, options);
  }

  createObjectFields<Type extends ObjectName<Types>>(name: Type, shape: FieldsShape<Types, Type>) {
    return new FieldSet(name, shape);
  }

  createQueryType(options: GiraphQLSchemaTypes.QueryTypeOptions<Types>) {
    return new RootType<Types, 'Query'>('Query', options);
  }

  createQueryFields(shape: RootFieldsShape<Types, 'Query'>) {
    return new RootFieldSet('Query', shape);
  }

  createMutationType(options: GiraphQLSchemaTypes.MutationTypeOptions<Types>) {
    return new RootType<Types, 'Mutation'>('Mutation', options);
  }

  createMutationFields(shape: RootFieldsShape<Types, 'Mutation'>) {
    return new RootFieldSet('Mutation', shape);
  }

  createSubscriptionType(options: GiraphQLSchemaTypes.SubscriptionTypeOptions<Types>) {
    return new RootType<Types, 'Subscription'>('Subscription', options);
  }

  createSubscription(shape: RootFieldsShape<Types, 'Mutation'>) {
    return new RootFieldSet('Mutation', shape);
  }

  createArgs<Shape extends InputFields<Types>>(shape: (t: InputFieldBuilder<Types>) => Shape) {
    return shape(new InputFieldBuilder<Types>());
  }

  createInterfaceType<Shape extends {}, Type extends InterfaceName<Types>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Shape, Types, Type>,
  ) {
    return new InterfaceType<Shape, Types, Type>(name, options);
  }

  createInterfaceFields<Type extends InterfaceName<Types>>(
    name: Type,
    shape: FieldsShape<Types, Type>,
  ) {
    return new FieldSet(name, shape);
  }

  createUnionType<Member extends ObjectName<Types>, Name extends string>(
    name: Name,
    options: GiraphQLSchemaTypes.UnionOptions<Types, Member>,
  ) {
    return new UnionType<Types, Name, Member>(name, options);
  }

  createEnumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: GiraphQLSchemaTypes.EnumTypeOptions<Values>,
  ) {
    return new EnumType(name, options);
  }

  createScalar<Name extends ScalarName<Types>>(name: Name, scalar: GraphQLScalarType) {
    return new ScalarType<Types, Name>(name, scalar);
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
    return new InputObjectType<
      Types,
      Shape,
      Fields,
      Name,
      InputShapeFromFields<Types, Fields, undefined>
    >(name, options);
  }

  toSchema(
    types: ImplementedType<Types>[],
    {
      fieldDefinitions,
      directives,
      extensions,
    }: {
      directives?: readonly GraphQLDirective[];
      extensions?: Record<string, unknown>;
      fieldDefinitions?: (FieldSet<Types, TypeParam<Types>> | RootFieldSet<Types, RootName>)[];
    } = {},
  ) {
    const scalars = [
      this.scalars.Boolean,
      this.scalars.Float,
      this.scalars.ID,
      this.scalars.Int,
      this.scalars.String,
    ];

    const buildCache = new BuildCache<Types>([...scalars, ...types], {
      plugins: this.plugins,
      fieldDefinitions,
    });

    buildCache.buildAll();

    const builtTypes = [...buildCache.types.values()].map(entry => entry.built);

    return new GraphQLSchema({
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
  }
}
