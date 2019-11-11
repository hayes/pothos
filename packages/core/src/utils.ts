import { GraphQLList, GraphQLOutputType, GraphQLInputType, GraphQLNonNull } from 'graphql';
import { TypeParam, InputField, InputType, InputName, ScalarName } from './types';
import BaseType from './graphql/base';
import InputObjectType from './graphql/input';
import { BuildCache } from '.';

export function typeFromParam<Types extends GiraphQLSchemaTypes.TypeInfo>(
  param: TypeParam<Types> | BaseType<Types, string, unknown> | [BaseType<Types, string, unknown>],
  cache: BuildCache<Types>,
): GraphQLOutputType {
  if (typeof param === 'string') {
    return cache.getBuilt(param);
  }

  if (Array.isArray(param)) {
    return GraphQLList(typeFromParam(param[0], cache));
  }

  if (typeof param === 'function') {
    return typeFromParam(param, cache);
  }

  if (param instanceof BaseType) {
    if (cache.getType(param.typename) !== param) {
      throw new Error(`Found unexpected type of same name ${param.typename}`);
    }
    return cache.getBuilt(param.typename);
  }

  throw new Error(`Unable to resolve typeParam ${Object.keys(param)} ${param}`);
}

export function isInputName<Types extends GiraphQLSchemaTypes.TypeInfo>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
): arg is InputName<Types> | ScalarName<Types> {
  return typeof arg === 'string';
}

export function buildArg<Types extends GiraphQLSchemaTypes.TypeInfo>(
  arg: InputField<Types> | InputType<Types> | InputType<Types>[],
  cache: BuildCache<Types>,
): GraphQLInputType {
  if (isInputName(arg)) {
    return cache.getBuiltInput(arg as string);
  }

  if (Array.isArray(arg)) {
    return new GraphQLList(buildArg(arg[0], cache));
  }

  if (arg instanceof BaseType || arg instanceof InputObjectType) {
    if (cache.getType(arg.typename) !== arg) {
      throw new Error(`Found unexpected type of same name ${arg.typename}`);
    }
    return cache.getBuiltInput(arg.typename);
  }

  if (arg.required) {
    return new GraphQLNonNull(buildArg(arg.type, cache));
  }

  return buildArg(arg.type, cache);
}
