/* eslint-disable no-param-reassign */
import {
  BuildCache,
  getObjectFieldOptions,
  getObjectOptions,
  getQueryFieldOptions,
} from '@giraphql/core';
import {
  GraphQLResolveInfo,
  GraphQLNamedType,
  GraphQLFieldConfig,
  GraphQLObjectType,
  GraphQLInterfaceType,
  GraphQLUnionType,
  GraphQLType,
  GraphQLNonNull,
  GraphQLList,
} from 'graphql';

import './global-types';
import { FieldSubscriptionManager } from '.';

function unwrapType(type: GraphQLType): GraphQLNamedType {
  if (type instanceof GraphQLNonNull) {
    return unwrapType(type.ofType);
  }

  if (type instanceof GraphQLList) {
    return unwrapType(type.ofType);
  }

  return type;
}

export default function createFieldData(
  parentType: GraphQLObjectType | GraphQLInterfaceType,
  name: string,
  config: GraphQLFieldConfig<unknown, object>,
  data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
  buildCache: BuildCache,
) {
  data.smartSubscriptions = { subscriptionByType: {}, canRefetch: false };
  const fieldType = unwrapType(config.type);

  if (parentType instanceof GraphQLObjectType && fieldType instanceof GraphQLObjectType) {
    const options = getObjectFieldOptions(parentType, config, name);
    data.smartSubscriptions.objectSubscription = getObjectOptions(fieldType).subscribe;
    data.smartSubscriptions.canRefetch = options.canRefetch || false;
  } else if (fieldType instanceof GraphQLInterfaceType) {
    const implementers = buildCache.getImplementers(fieldType);

    implementers.forEach((obj) => {
      data.smartSubscriptions!.subscriptionByType[obj.name] = getObjectOptions(obj).subscribe;
    });
  } else if (fieldType instanceof GraphQLUnionType) {
    fieldType.getTypes().forEach((member) => {
      data.smartSubscriptions!.subscriptionByType[member.name] = getObjectOptions(member).subscribe;
    });
  }

  if (parentType.name === 'Subscription') {
    const queryType = buildCache.getTypeOfKind('Query', 'Object');
    const queryFields = queryType.getFields();

    const queryField = queryFields[name];

    if (!queryField) {
      return;
    }

    const options = getQueryFieldOptions(queryType, queryField, name);

    if (options.subscribe && options.smartSubscription) {
      data.smartSubscriptions.subscribe = options.subscribe;
    }

    return;
  }

  if (!(parentType instanceof GraphQLObjectType)) {
    return;
  }

  const options = getObjectFieldOptions(parentType, config, name);

  if (options.subscribe) {
    data.smartSubscriptions.subscribe = options.subscribe as (
      subscriptions: FieldSubscriptionManager,
      parent: unknown,
      args: {},
      context: object,
      info: GraphQLResolveInfo,
    ) => void;
  }
}
