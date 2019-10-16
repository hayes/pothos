/* eslint-disable class-methods-use-this */

import { GraphQLEnumValueConfigMap } from 'graphql';
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
import FieldBuilder from './fieldBuilder';
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
      {},
      {}
    >[]
  >(name: Type, options: ObjectTypeOptions<Types, Type, ParentShape, Shape, Context, Interfaces>) {
    return new ObjectType<Types, Type, ParentShape, Shape, Context, Interfaces>(name, options);
  }

  createInterfaceType<Type extends keyof Types, ParentShape extends {}, Shape extends ParentShape>(
    name: Type,
    options: InterfaceTypeOptions<Types, Type, ParentShape, Shape, Context>,
  ) {
    return new InterfaceType<Types, Type, ParentShape, Shape, Context>(name, options);
  }

  fieldBuilder<Type extends keyof Types>(name: Type) {
    return new FieldBuilder<{}, Types, typeof name, Context>({
      fields: {},
    });
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
}

// Create input types
export const ID = new InputType<bigint>('ID');
export const Int = new InputType<number>('Int');
