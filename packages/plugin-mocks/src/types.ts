import { Resolver, SchemaTypes, Subscriber } from '@giraphql/core';

export interface Resolvers<Types extends SchemaTypes, Parent = unknown> {
  [s: string]:
    | Resolver<Parent, {}, Types['Context'], unknown>
    | {
        resolve: Resolver<Parent, {}, Types['Context'], unknown>;
        subscribe: Subscriber<Parent, {}, Types['Context'], unknown>;
      };
}

export interface ResolverMap<Types extends SchemaTypes> {
  [s: string]: Resolvers<Types>;
}
