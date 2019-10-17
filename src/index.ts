/* eslint-disable class-methods-use-this, no-restricted-syntax */

import { GraphQLEnumValueConfigMap, GraphQLType } from 'graphql';
import {
  TypeMap,
  ObjectTypeOptions,
  InterfaceTypeOptions,
  ObjectShapeFromInterfaces,
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  EnumTypeOptions,
} from './types';
import BaseType from './base';
import ObjectType from './object';
import UnionType from './union';
import InputType from './input';
import InterfaceType from './interface';
import EnumType from './enum';

export default class SchemaBuilder<Types extends TypeMap, Context> {
  types: BaseType<Types>[] = [];

  createObjectType<
    Type extends Extract<keyof Types, string>,
    ParentShape extends ObjectShapeFromInterfaces<Types, Interfaces>,
    Shape extends ParentShape,
    Interfaces extends InterfaceType<
      Types,
      CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, true>>,
      {},
      {}
    >[]
  >(name: Type, options: ObjectTypeOptions<Types, Type, Shape, Context, Interfaces>) {
    return new ObjectType<Types, Type, Shape, Context, Interfaces>(name, options);
  }

  createInterfaceType<Type extends keyof Types, Shape extends {}>(
    name: Type,
    options: InterfaceTypeOptions<Types, Type, Shape, Context>,
  ) {
    return new InterfaceType<Types, Type, Shape, Context>(name, options);
  }

  createUnionType<Member extends keyof Types>(
    name: string,
    options: {
      members: Member[];
      resolveType: (parent: Types[Member], context: Context) => Member | Promise<Member>;
    },
  ) {
    return new UnionType<Types, Context, Member>(name, options);
  }

  createEnumType<
    Name extends string,
    Values extends { [s: number]: string } | string[] | GraphQLEnumValueConfigMap
  >(name: Name, options: EnumTypeOptions<Values>) {
    return new EnumType(name, options);
  }

  toSchema(types: BaseType<unknown>[]) {
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
