import { builder } from './builder';
import './nodes';

const article = { title: 'Getting started', writes: 0 };

builder.queryType({
  fields: (t) => ({
    // #region protected-fields
    message: t.string({ authScopes: { loggedIn: true }, resolve: () => 'hi' }),
    article: t.string({
      authScopes: { $all: { loggedIn: true, permission: 'readArticle' } },
      resolve: () => article.title,
    }),
    editPreview: t.string({
      authScopes: { $all: { loggedIn: true, permission: 'editArticle' } },
      resolve: () => 'You can edit this article',
    }),
    // #endregion protected-fields
    // Public fixture counters make skipped resolver effects observable.
    savedTitle: t.string({ resolve: () => article.title }),
    writes: t.int({ resolve: () => article.writes }),
  }),
});
builder.mutationType({
  fields: (t) => ({
    // #region protected-write
    renameArticle: t.string({
      authScopes: { $all: { loggedIn: true, permission: 'editArticle' } },
      args: { title: t.arg.string({ required: true }) },
      resolve: (_parent, { title }) => {
        article.writes += 1;
        article.title = title;
        return article.title;
      },
    }),
    // #endregion protected-write
  }),
});
export const schema = builder.toSchema();
