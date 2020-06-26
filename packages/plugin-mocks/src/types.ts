import { Subscriber, Resolver, SchemaTypes } from '@giraphql/core';

export type Resolvers<Types extends SchemaTypes, Parent = unknown> = {
  [s: string]:
    | Resolver<Parent, {}, Types['Context'], unknown>
    | {
        resolve: Resolver<Parent, {}, Types['Context'], unknown>;
        subscribe: Subscriber<Parent, {}, Types['Context'], unknown>;
      };
};

export type ResolverMap<Types extends SchemaTypes> = {
  [s: string]: Resolvers<Types>;
};
