/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { GraphQLList, GraphQLOutputType, GraphQLInputType, GraphQLNonNull } from 'graphql';
import { TypeParam, InputField, InputType, FieldNullability, SchemaTypes } from './types';
import BaseType from './graphql/base';
import InputObjectType from './graphql/input';
import { BuildCache } from '.';

export function typeFromNonListParam(
  param: Exclude<TypeParam<any>, [unknown]>,
  cache: BuildCache<SchemaTypes>,
): GraphQLOutputType {
  if (typeof param === 'string') {
    return cache.getBuilt(param);
  }

  if (param instanceof BaseType) {
    if (cache.getType(param.typename) !== param) {
      throw new Error(`Found unexpected type of same name ${param.typename}`);
    }
    return cache.getBuilt(param.typename);
  }

  throw new Error(`Unable to resolve typeParam ${Object.keys(param)} ${param}`);
}

export function typeFromMaybeNullParam(
  param: Exclude<TypeParam, [unknown]> | BaseType,
  cache: BuildCache,
  nullable: boolean,
): GraphQLOutputType {
  const type = typeFromNonListParam(param, cache);

  if (nullable) {
    return type;
  }

  return new GraphQLNonNull(type);
}

export function typeFromParam(
  param: TypeParam | BaseType | [BaseType],
  cache: BuildCache,
  nullable: FieldNullability,
): GraphQLOutputType {
  const itemNullable = typeof nullable === 'object' ? nullable.items : false;
  const listNullable = typeof nullable === 'object' ? nullable.list : !!nullable;

  if (Array.isArray(param)) {
    const itemType = typeFromMaybeNullParam(
      param[0] as Exclude<typeof param, [unknown]>,
      cache,
      itemNullable,
    );
    const listType = new GraphQLList(itemType);

    if (listNullable) {
      return listType;
    }

    return new GraphQLNonNull(listType);
  }

  return typeFromMaybeNullParam(param as Exclude<typeof param, [unknown]>, cache, listNullable);
}

export function isInputName<Types extends SchemaTypes = SchemaTypes>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
): arg is string {
  return typeof arg === 'string';
}

export function buildRequiredArg<Types extends SchemaTypes>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
  cache: BuildCache,
) {
  return new GraphQLNonNull(buildArg(arg, cache));
}

export function buildArg<Types extends SchemaTypes = SchemaTypes>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
  cache: BuildCache,
  nullableListItems = false,
): GraphQLInputType {
  if (isInputName(arg)) {
    return cache.getBuiltInput(arg as string);
  }

  if (Array.isArray(arg)) {
    if (nullableListItems) {
      return new GraphQLList(buildArg(arg[0], cache));
    }

    return new GraphQLList(buildRequiredArg(arg[0], cache));
  }

  if (arg instanceof BaseType || arg instanceof InputObjectType) {
    if (cache.getType(arg.typename) !== arg) {
      throw new Error(`Found unexpected type of same name ${arg.typename}`);
    }
    return cache.getBuiltInput(arg.typename);
  }

  if (typeof arg.required === 'object') {
    const builtArg = buildArg(arg.type, cache, !arg.required.items);

    if (arg.required.list) {
      return new GraphQLNonNull(builtArg);
    }

    return builtArg;
  }

  if (arg.required) {
    return new GraphQLNonNull(buildArg(arg.type, cache));
  }

  return buildArg(arg.type, cache);
}
