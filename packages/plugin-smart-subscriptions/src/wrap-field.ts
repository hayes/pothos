/* eslint-disable no-param-reassign */

import { ResolveValueWrapper } from '@giraphql/core';
import { GraphQLFieldConfig, GraphQLResolveInfo } from 'graphql';

import './global-types';
import { WrappedResolver } from './types';
import SubscriptionManager from './manager';

export default function wrapField(
  config: GraphQLFieldConfig<unknown, object>,
  getManager: (context: object, info: GraphQLResolveInfo) => SubscriptionManager | undefined,
) {
  const originalResolve = config.resolve!;

  const wrappedResolver: WrappedResolver = (maybeWrappedParent, args, context, info) => {
    if (!getManager(context, info)) {
      return originalResolve(maybeWrappedParent, args, context, info);
    }

    const parentWrapper = ResolveValueWrapper.wrap(maybeWrappedParent);

    const { cache } = parentWrapper.data.smartSubscriptions!;

    return cache.resolve(parentWrapper, args, context, info, originalResolve);
  };

  wrappedResolver.unwrap = () => (originalResolve as WrappedResolver).unwrap();

  config.resolve = wrappedResolver as WrappedResolver;
}
