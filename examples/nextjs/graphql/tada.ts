import { initGraphQLTada } from 'gql.tada';
import type { introspection } from '../graphql-env';

// gql.tada infers result/variable types directly from the schema in the TypeScript type system.
// The schema is regenerated into `graphql-env.d.ts` by `pnpm generate` whenever the schema changes.
export const graphql = initGraphQLTada<{
  introspection: introspection;
}>();

export type { FragmentOf, ResultOf, VariablesOf } from 'gql.tada';
