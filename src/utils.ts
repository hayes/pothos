/* eslint-disable import/prefer-default-export */

import { GraphQLList, GraphQLOutputType } from 'graphql';
import { TypeParam, TypeMap } from './types';
import TypeStore from './store';
import BaseType from './base';

export function typeFromParam<Types extends TypeMap>(
  param: TypeParam<Types> | BaseType<Types, string, unknown> | [BaseType<Types, string, unknown>],
  typeStore: TypeStore<Types>,
): GraphQLOutputType {
  if (typeof param === 'string') {
    typeStore.getBuilt(param);
  }

  if (Array.isArray(param)) {
    return GraphQLList(typeFromParam(param[0], typeStore));
  }

  if (typeof param === 'function') {
    return typeFromParam(param(), typeStore);
  }

  throw new Error(`Unable to resolve typeParam ${typeFromParam}`);
}
