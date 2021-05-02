import { Resolver, SchemaTypes, Subscriber } from '@giraphql/core';

export type Resolvers<Types extends SchemaTypes, Parent> = Record<
  string,
  | Resolver<Parent, {}, Types['Context'], unknown>
  | {
      resolve: Resolver<Parent, {}, Types['Context'], unknown>;
      subscribe: Subscriber<Parent, {}, Types['Context'], unknown>;
    }
>;

export type ResolverMap<Types extends SchemaTypes> = Record<string, Resolvers<Types, unknown>>;
