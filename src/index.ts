/* eslint-disable class-methods-use-this */

import { TypeMap, ObjectTypeOptions } from './types';
import BaseType from './base';
import ObjectType from './object';
import UnionType from './union';
import FieldBuilder from './fieldBuilder';
import InputType from './input';

export default class SchemaBuilder<Types extends TypeMap, Context> {
  types: BaseType<Types>[] = [];

  createObjectType<Type extends keyof Types, Shape extends {}>(
    name: Type,
    options: ObjectTypeOptions<Types, Type, Shape, Context>,
  ) {
    return new ObjectType<Types, typeof name, Shape, Context>(name, options);
  }

  fieldBuilder<Type extends keyof Types>(name: Type) {
    return new FieldBuilder<{}, Types, Context, typeof name>();
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
}

// Create input types
export const ID = new InputType<bigint>('ID');
export const Int = new InputType<number>('Int');
