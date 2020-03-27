/* eslint-disable no-param-reassign */
import { Field, TypeParam, BuildCache } from '@giraphql/core';
import { GraphQLResolveInfo } from 'graphql';

import './global-types';
import { FieldSubscriptionManager } from '.';

export default function createFieldData(
  name: string,
  field: Field<{}, any, TypeParam<any>>,
  data: Partial<GiraphQLSchemaTypes.FieldWrapData>,
  buildCache: BuildCache,
) {
  data.smartSubscriptions = { subscriptionByType: {}, canRefetch: false };
  const nonListType = Array.isArray(field.type) ? field.type[0] : field.type;
  const typename = typeof nonListType === 'object' ? nonListType.typename : nonListType;
  const fieldType = buildCache.getEntry(typename);

  if (fieldType.kind === 'Object') {
    data.smartSubscriptions.objectSubscription = fieldType.type.options.subscribe;
    data.smartSubscriptions.canRefetch =
      (field.options as GiraphQLSchemaTypes.ObjectFieldOptions<
        any,
        {},
        TypeParam<any>,
        boolean,
        {}
      >).canRefetch || false;
  } else if (fieldType.kind === 'Interface') {
    const implementers = buildCache.getImplementers(typename);

    implementers.forEach(obj => {
      data.smartSubscriptions!.subscriptionByType[obj.typename] = obj.options.subscribe;
    });
  } else if (fieldType.kind === 'Union') {
    fieldType.type.members.forEach(memberName => {
      data.smartSubscriptions!.subscriptionByType[memberName] = buildCache.getEntryOfType(
        memberName,
        'Object',
      ).type.options.subscribe;
    });
  }

  if (field.parentTypename === 'Subscription') {
    const queryFields = buildCache.getFields('Query');

    const queryField = queryFields[name];

    if (!queryField) {
      return;
    }

    const options = queryField.options as GiraphQLSchemaTypes.QueryFieldOptions<
      any,
      TypeParam<any>,
      boolean,
      {}
    >;

    if (options.subscribe && options.smartSubscription) {
      data.smartSubscriptions.subscribe = options.subscribe;
    }

    return;
  }
  const type = buildCache.getEntry(field.parentTypename);

  if (type.kind !== 'Object') {
    return;
  }

  const options = field.options as GiraphQLSchemaTypes.ObjectFieldOptions<
    any,
    {},
    TypeParam<any>,
    boolean,
    {}
  >;

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
