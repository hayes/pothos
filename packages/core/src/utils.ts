/* eslint-disable no-use-before-define, @typescript-eslint/no-use-before-define */
import { GraphQLList, GraphQLOutputType, GraphQLInputType, GraphQLNonNull } from 'graphql';
import { TypeParam, InputField, InputType, InputName, ScalarName, FieldNullability } from './types';
import BaseType from './graphql/base';
import InputObjectType from './graphql/input';
import { BuildCache } from '.';

export function typeFromNonListParam<Types extends GiraphQLSchemaTypes.TypeInfo>(
  param: Exclude<TypeParam<Types>, [unknown]> | BaseType<Types, string, unknown>,
  cache: BuildCache<Types>,
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

export function typeFromMaybeNullParam<Types extends GiraphQLSchemaTypes.TypeInfo>(
  param: Exclude<TypeParam<Types>, [unknown]> | BaseType<Types, string, unknown>,
  cache: BuildCache<Types>,
  nullable: boolean,
): GraphQLOutputType {
  const type = typeFromNonListParam(param, cache);

  if (nullable) {
    return type;
  }

  return new GraphQLNonNull(type);
}

export function typeFromParam<Types extends GiraphQLSchemaTypes.TypeInfo>(
  param: TypeParam<Types> | BaseType<Types, string, unknown> | [BaseType<Types, string, unknown>],
  cache: BuildCache<Types>,
  nullable: FieldNullability<Types, TypeParam<Types>>,
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

export function isInputName<Types extends GiraphQLSchemaTypes.TypeInfo>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
): arg is InputName<Types> | ScalarName<Types> {
  return typeof arg === 'string';
}

export function buildRequiredArg<Types extends GiraphQLSchemaTypes.TypeInfo>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
  cache: BuildCache<Types>,
) {
  return new GraphQLNonNull(buildArg(arg, cache));
}

export function buildArg<Types extends GiraphQLSchemaTypes.TypeInfo>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
  cache: BuildCache<Types>,
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
    const builtArg = arg.required.items
      ? buildRequiredArg(arg.type, cache)
      : buildArg(arg.type, cache, true);

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
