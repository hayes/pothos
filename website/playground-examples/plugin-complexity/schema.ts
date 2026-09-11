import SchemaBuilder from '@pothos/core';
import ComplexityPlugin, { complexityFromQuery } from '@pothos/plugin-complexity';
import { parse } from 'graphql';

// #region limits
const builder = new SchemaBuilder({
  plugins: [ComplexityPlugin],
  complexity: {
    defaultComplexity: 1,
    defaultListMultiplier: 10,
    limit: { complexity: 20, depth: 3, breadth: 5 },
  },
});
// #endregion limits

const Post = builder.objectRef<{ title: string }>('Post');
Post.implement({
  fields: (t) => ({
    title: t.exposeString('title'),
    related: t.field({ type: Post, resolve: (post) => post }),
  }),
});
const posts = [{ title: 'First post' }, { title: 'Second post' }];
let resolverCalls = 0;

builder.queryType({
  fields: (t) => ({
    // #region field-cost
    posts: t.field({
      type: [Post],
      args: { limit: t.arg.int({ defaultValue: 2 }) },
      complexity: (args) => ({ field: 5, multiplier: Math.max(0, args.limit ?? 2) }),
      resolve: (_parent, args) => {
        resolverCalls += 1;
        return posts.slice(0, Math.max(0, args.limit ?? 2));
      },
    }),
    // #endregion field-cost
    resolverCalls: t.int({ resolve: () => resolverCalls }),
    estimatedCost: t.int({
      args: { limit: t.arg.int({ required: true }) },
      resolve: (_parent, { limit }) =>
        complexityFromQuery(parse('query Cost($limit: Int!) { posts(limit: $limit) { title } }'), {
          schema,
          variables: { limit },
          ctx: {},
        }).complexity,
    }),
  }),
});
export const schema = builder.toSchema();
