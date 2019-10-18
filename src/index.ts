/* eslint-disable no-restricted-syntax */

import { GraphQLEnumValueConfigMap } from 'graphql';
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
} from './types';
import ObjectType from './object';
import UnionType from './union';
import InputType from './input';
import InterfaceType from './interface';
import EnumType from './enum';
import TypeStore from './store';

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

  createEnumType<
    Name extends string,
    Values extends { [s: number]: string } | string[] | GraphQLEnumValueConfigMap
  >(name: Name, options: EnumTypeOptions<Values>) {
    return new EnumType(name, options);
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
  }
}

// Create input types
export const ID = new InputType<bigint>('ID');
export const Int = new InputType<number>('Int');
