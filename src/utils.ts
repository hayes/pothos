import { GraphQLList, GraphQLOutputType, GraphQLInputType, GraphQLNonNull } from 'graphql';
import { TypeParam, TypeMap, InputField } from './types';
import TypeStore from './store';
import BaseType from './base';
import InputType from './input';

export function typeFromParam<Types extends TypeMap>(
  param: TypeParam<Types> | BaseType<Types, string, unknown> | [BaseType<Types, string, unknown>],
  typeStore: TypeStore<Types>,
): GraphQLOutputType {
  if (typeof param === 'string') {
    return typeStore.getBuilt(param);
  }

  if (Array.isArray(param)) {
    return GraphQLList(typeFromParam(param[0], typeStore));
  }

  if (typeof param === 'function') {
    return typeFromParam(param(), typeStore);
  }

  if (param instanceof BaseType) {
    return typeStore.getBuilt(param.typename);
  }

  throw new Error(`Unable to resolve typeParam ${Object.keys(param)} ${param}`);
}

export function buildArg<Types extends TypeMap>(
  arg: InputField | InputType<{}, {}, string> | InputType<{}, {}, string>[],
  store: TypeStore<Types>,
): GraphQLInputType {
  if (typeof arg === 'function') {
    return buildArg(arg(), store);
  }

  if (Array.isArray(arg)) {
    return new GraphQLList(buildArg(arg[0], store));
  }

  if (arg instanceof InputType) {
    return store.getBuiltInput(arg.typename);
  }

  if (arg.required) {
    return new GraphQLNonNull(buildArg(arg.type, store));
  }

  return buildArg(arg.type, store);
}
