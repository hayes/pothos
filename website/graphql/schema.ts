// eslint-disable-next-line import/extensions
import searchIndex from '../util/search-index.js';
import {
  DocsIndex,
  DocsSection,
  SearchMatch,
  SearchMatcher,
  SearchMatchKind,
  SearchResult,
} from '../util/search-matcher';
import { builder } from './builder';

const DocsPage = builder.objectRef<DocsIndex>('DocsPage').implement({
  fields: (t) => ({
    title: t.exposeString('name'),
    description: t.exposeString('description'),
    link: t.exposeString('link'),
    md: t.exposeString('md'),
    html: t.exposeString('html'),
  }),
});

builder.enumType(SearchMatchKind, { name: 'SearchMatchKind' });

const SearchMatchRef = builder.objectRef<SearchMatch>('SearchMatch').implement({
  fields: (t) => ({
    kind: t.expose('kind', { type: SearchMatchKind }),
    section: t.expose('section', { type: DocsSectionRef, nullable: true }),
  }),
});

const SearchResultRef = builder.objectRef<SearchResult>('SearchResult').implement({
  fields: (t) => ({
    matches: t.expose('matches', { type: [SearchMatchRef] }),
    doc: t.expose('doc', { type: DocsPage, nullable: true }),
  }),
});

const DocsSectionRef = builder.objectRef<DocsSection>('DocsSection').implement({
  fields: (t) => ({
    heading: t.exposeString('heading'),
    link: t.exposeString('link'),
    md: t.exposeString('md'),
    html: t.exposeString('html'),
  }),
});

builder.queryType({
  fields: (t) => ({
    search: t.field({
      type: [SearchResultRef],
      args: {
        query: t.arg.string({
          required: true,
        }),
      },
      resolve: (_, { query }) => new SearchMatcher(query).matchDocs(searchIndex).getResults(),
    }),
  }),
});

export const schema = builder.toSchema();
