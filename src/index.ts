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
  ObjectTypeOptions,
  InterfaceTypeOptions,
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  EnumTypeOptions,
  NamedTypeParam,
  ImplementedType,
  StoreEntry,
  EnumValues,
  ShapedInputFields,
  MergeTypeMap,
  DefaultTypeMap,
  InputFields,
  InputShapeFromFields,
  PartialTypeMap,
} from './types';
import ObjectType from './object';
import UnionType from './union';
import InputObjectType from './input';
import InterfaceType from './interface';
import EnumType from './enum';
import TypeStore from './store';
import ScalarType from './scalar';

export default class SchemaBuilder<
  PartialTypes extends PartialTypeMap,
  Context,
  Types extends MergeTypeMap<DefaultTypeMap, PartialTypes> = MergeTypeMap<
    DefaultTypeMap,
    PartialTypes
  >
> {
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
      CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
      {}
    >[],
    Type extends Extract<keyof Types['Output'], string>
  >(name: Type, options: ObjectTypeOptions<Shape, Interfaces, Types, Type, Context>) {
    return new ObjectType<Shape, Interfaces, Types, Type, Context>(name, options);
  }

  createInterfaceType<Shape extends {}, Type extends Extract<keyof Types['Output'], string>>(
    name: Type,
    options: InterfaceTypeOptions<Shape, Types, Type, Context>,
  ) {
    return new InterfaceType<Shape, Types, Type, Context>(name, options);
  }

  createUnionType<Member extends NamedTypeParam<Types>, Name extends string>(
    name: Name,
    options: {
      members: Member[];
      resolveType: (parent: Types['Output'][Member], context: Context) => Member | Promise<Member>;
    },
  ) {
    return new UnionType<Types, Context, Name, Member>(name, options);
  }

  createEnumType<Name extends string, Values extends EnumValues>(
    name: Name,
    options: EnumTypeOptions<Values>,
  ) {
    return new EnumType(name, options);
  }

  createScalar<Name extends NamedTypeParam<Types>>(name: Name, scalar: GraphQLScalarType) {
    return new ScalarType<Types, Name>(name, scalar);
  }

  createInputType<
    Name extends string,
    Fields extends Name extends keyof Types['Input']
      ? ShapedInputFields<Types, Name>
      : InputFields<Types>
  >(name: Name, options: { fields: Fields }) {
    return new InputObjectType<Types, InputShapeFromFields<Types, Fields>, Fields, Name>(
      name,
      options,
    );
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
        built: type.buildType(typeStore),
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
