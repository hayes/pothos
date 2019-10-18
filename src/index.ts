/* eslint-disable no-restricted-syntax */

import { GraphQLEnumValueConfigMap, GraphQLType } from 'graphql';
import {
  TypeMap,
  ObjectTypeOptions,
  InterfaceTypeOptions,
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  EnumTypeOptions,
  NamedTypeParam,
} from './types';
import BaseType from './base';
import ObjectType from './object';
import UnionType from './union';
import InputType from './input';
import InterfaceType from './interface';
import EnumType from './enum';

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

  toSchema(types: BaseType<unknown, string>[]) {
    const typeMap = new Map<string, GraphQLType>();

    for (const type of types) {
      if (typeMap.has(type.typename)) {
        throw new Error(`Received multiple implementations of type ${type.typename}`);
      }

      typeMap.set(type.typename, type.buildType(typeMap));
    }
  }
}

// Create input types
export const ID = new InputType<bigint>('ID');
export const Int = new InputType<number>('Int');
