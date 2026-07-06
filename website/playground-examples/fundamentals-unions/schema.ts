import SchemaBuilder from '@pothos/core';

interface ICharacter {
  kind: 'Character';
  id: string;
  name: string;
}

interface ILocation {
  kind: 'Location';
  id: string;
  name: string;
  terrain: string;
}

interface IQuote {
  kind: 'Quote';
  id: string;
  text: string;
}

type SearchHit = ICharacter | ILocation | IQuote;

const Index: SearchHit[] = [
  { kind: 'Character', id: 'frodo', name: 'Frodo Baggins' },
  { kind: 'Location', id: 'shire', name: 'The Shire', terrain: 'rolling hills' },
  { kind: 'Quote', id: 'q1', text: 'All we have to decide is what to do with the time given us.' },
];

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character').implement({
  fields: (t) => ({ id: t.exposeID('id'), name: t.exposeString('name') }),
});

const Location = builder.objectRef<ILocation>('Location').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    terrain: t.exposeString('terrain'),
  }),
});

const Quote = builder.objectRef<IQuote>('Quote').implement({
  fields: (t) => ({ id: t.exposeID('id'), text: t.exposeString('text') }),
});

// A union groups unrelated object types behind a single field type.
// resolveType returns the concrete typename for any given value.
// #region search-result-union
const SearchResult = builder.unionType('SearchResult', {
  types: [Character, Location, Quote],
  resolveType: (val) => val.kind,
});
// #endregion search-result-union

// #region search-query
builder.queryType({
  fields: (t) => ({
    search: t.field({
      type: [SearchResult],
      args: { term: t.arg.string({ required: true }) },
      resolve: (_root, { term }) => {
        const needle = term.toLowerCase();
        return Index.filter((hit) => {
          if (hit.kind === 'Quote') return hit.text.toLowerCase().includes(needle);
          return hit.name.toLowerCase().includes(needle);
        });
      },
    }),
  }),
});
// #endregion search-query

export const schema = builder.toSchema();
