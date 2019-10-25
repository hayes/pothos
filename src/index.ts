/* eslint-disable no-restricted-syntax */
import { GraphQLSchema, GraphQLScalarType } from 'graphql';
import {
  TypeMap,
  ObjectTypeOptions,
  InterfaceTypeOptions,
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  EnumTypeOptions,
  NamedTypeParam,
  ImplementedType,
  StoreEntry,
  EnumValues,
  InputFields,
  InputShapeFromFields,
} from './types';
import ObjectType from './object';
import UnionType from './union';
import InputObjectType from './input';
import InterfaceType from './interface';
import EnumType from './enum';
import TypeStore from './store';
import ScalarType from './scalar';

export default class SchemaBuilder<Types extends TypeMap, Context> {
  createObjectType<
    Shape extends {},
    Interfaces extends InterfaceType<
      {},
      Types,
      CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
      {}
    >[],
    Type extends Extract<keyof Types, string>
  >(name: Type, options: ObjectTypeOptions<Shape, Interfaces, Types, Type, Context>) {
    return new ObjectType<Shape, Interfaces, Types, Type, Context>(name, options);
  }

  createInterfaceType<Shape extends {}, Type extends Extract<keyof Types, string>>(
    name: Type,
    options: InterfaceTypeOptions<Shape, Types, Type, Context>,
  ) {
    return new InterfaceType<Shape, Types, Type, Context>(name, options);
  }

  createUnionType<Member extends NamedTypeParam<Types>, Name extends string>(
    name: Name,
    options: {
      members: Member[];
      resolveType: (parent: Types[Member], context: Context) => Member | Promise<Member>;
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
    return new ScalarType<Types, Name, Types[Name]>(name, scalar);
  }

  createInputType<
    Shape extends InputShapeFromFields<Types, Fields>,
    Name extends string,
    Fields extends InputFields<Types>
  >(name: Name, options: { fields: Fields }) {
    return new InputObjectType<Types, Shape, Fields, Name>(name, options);
  }

  toSchema(types: ImplementedType<Types>[]) {
    const typeStore = new TypeStore<Types>();

    for (const type of types) {
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
