import SchemaBuilder from '@pothos/core';
import DirectivePlugin from '@pothos/plugin-directives';
import FederationPlugin from '@pothos/plugin-federation';

const builder = new SchemaBuilder({
  // If you are using other plugins, the federation plugin should be listed after plugins like auth that wrap resolvers
  plugins: [DirectivePlugin, FederationPlugin],
});

// #region service
type ReviewRecord = { id: string; body: string; authorID: string; authorUsername: string };
const reviews: ReviewRecord[] = [
  { id: '1', body: 'Useful notebook', authorID: '1', authorUsername: 'leia' },
];

const User = builder.externalRef('User', builder.selection<{ id: string }>('id')).implement({
  externalFields: (t) => ({
    // The field that will be provided
    username: t.string(),
  }),
  fields: (t) => ({
    id: t.exposeID('id'),
  }),
});

const Review = builder.objectRef<ReviewRecord>('Review');
Review.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    body: t.exposeString('body'),
    author: t.field({
      // using User.provides<...>(...) instead of just User adds the provide annotations
      // and ensures the resolved value includes data for the provided field
      // The generic in Type.provides works the same as the `builder.selection` method.
      type: User.provides<{ username: string }>('username'),
      resolve: (review) => ({
        id: review.authorID,
        username: review.authorUsername,
      }),
    }),
  }),
});

builder.queryType({
  fields: (t) => ({
    reviews: t.field({ type: [Review], resolve: () => reviews }),
  }),
});
// #endregion service

export const schema = builder.toSubGraphSchema({});
