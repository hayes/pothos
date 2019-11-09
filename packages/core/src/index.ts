/* eslint-disable no-restricted-syntax */
import {
  GraphQLSchema,
  GraphQLScalarType,
  GraphQLString,
  GraphQLInt,
  GraphQLID,
  GraphQLFloat,
  GraphQLBoolean,
} from 'graphql';
import {
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  NamedTypeParam,
  ImplementedType,
  StoreEntry,
  EnumValues,
  InputFields,
  InputShapeFromFields,
  ShapedInputFields,
  MergeTypeMap,
  DefaultTypeMap,
  NamedInputAndOutput,
  NullableToOptional,
} from './types';
import ObjectType from './object';
import UnionType from './union';
import InputObjectType from './input';
import InterfaceType from './interface';
import EnumType from './enum';
import TypeStore from './store';
import ScalarType from './scalar';
import InputFieldBuilder from './fieldUtils/input';
import BasePlugin from './plugin';
import Field from './field';

export * from './types';

export { EnumType, BasePlugin, Field, TypeStore, ObjectType, InterfaceType, UnionType };

export default class SchemaBuilder<
  PartialTypes extends GiraphQLSchemaTypes.PartialTypeInfo,
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
    Shape extends {},
    Interfaces extends InterfaceType<
      {},
      Types,
      CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, false>>
    >[],
    Type extends Extract<keyof Types['Output'], string>
  >(
    name: Type,
    options: NullableToOptional<
      GiraphQLSchemaTypes.ObjectTypeOptions<Shape, Interfaces, Types, Type>
    >,
  ) {
    return new ObjectType<Shape, Interfaces, Types, Type>(name, options);
  }

  createArgs<Shape extends InputFields<Types>>(shape: (t: InputFieldBuilder<Types>) => Shape) {
    return shape(new InputFieldBuilder<Types>());
  }

  createInterfaceType<Shape extends {}, Type extends Extract<keyof Types['Output'], string>>(
    name: Type,
    options: GiraphQLSchemaTypes.InterfaceTypeOptions<Shape, Types, Type>,
  ) {
    return new InterfaceType<Shape, Types, Type>(name, options);
  }

  createUnionType<Member extends NamedTypeParam<Types>, Name extends string>(
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

  createScalar<Name extends NamedInputAndOutput<Types>>(name: Name, scalar: GraphQLScalarType) {
    return new ScalarType<Types, Name>(name, scalar);
  }

  createInputType<
    Name extends string,
    Fields extends Name extends keyof Types['Input']
      ? ShapedInputFields<Types, Types['Input'][Name]>
      : InputFields<Types>,
    Shape extends Name extends keyof Types['Input']
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

  toSchema(types: ImplementedType<Types>[]) {
    const typeStore = new TypeStore<Types>();
    const scalars = [
      this.scalars.Boolean,
      this.scalars.Float,
      this.scalars.ID,
      this.scalars.Int,
      this.scalars.String,
    ];

    for (const type of [...scalars, ...types]) {
      if (typeStore.has(type.typename)) {
        throw new Error(`Received multiple implementations of type ${type.typename}`);
      }

      typeStore.set(type.typename, {
        built: type.buildType(typeStore, this.plugins),
        kind: type.kind,
        type,
      } as StoreEntry<Types>);
    }

    return new GraphQLSchema({
      query: typeStore.has('Query') ? typeStore.getBuiltObject('Query') : undefined,
      mutation: typeStore.has('Mutation') ? typeStore.getBuiltObject('Mutation') : undefined,
    });
  }
}
