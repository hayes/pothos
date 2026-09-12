import { builder } from './builder';

type Article = { id: string; title: string };
const articles: Article[] = [{ id: '1', title: 'A field guide to GraphQL' }];

// #region article-node
const ArticleNode = builder.objectRef<Article>('Article');

builder.node(ArticleNode, {
  id: { resolve: (article: Article) => article.id },
  loadOne: (id) => {
    return articles.find((article) => article.id === id) ?? null;
  },
  authScopes: {
    $any: {
      permission: 'readArticle',
      $granted: 'readFeaturedArticle',
    },
  },
  fields: (t) => ({
    title: t.exposeString('title'),
  }),
});
// #endregion article-node

// #region featured-article
builder.queryField('featuredArticle', (t) =>
  t.field({
    type: ArticleNode,
    nullable: true,
    grantScopes: ['readFeaturedArticle'],
    resolve: () => {
      return articles[0];
    },
  }),
);
// #endregion featured-article
