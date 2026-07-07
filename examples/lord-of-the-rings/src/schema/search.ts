import { builder } from '../builder.ts';
import {
  Characters,
  type ICharacter,
  type IItem,
  type ILocation,
  type IQuote,
  Items,
  Locations,
  Quotes,
} from '../data/canon.ts';
import { Quote } from './book.ts';
import { Dwarf, Elf, Hobbit, Man, Orc, Wizard } from './character.ts';
import { Artifact, RingOfPower, Weapon } from './item.ts';
import { Realm, Settlement, Stronghold, Wilderness } from './location.ts';

type SearchHit = ICharacter | ILocation | IItem | IQuote;

const SearchResult = builder.unionType('SearchResult', {
  description: 'Polymorphic search hit: a character, location, item, or quote.',
  types: [
    // Character variants
    Hobbit,
    Elf,
    Man,
    Dwarf,
    Wizard,
    Orc,
    // Location variants
    Realm,
    Settlement,
    Wilderness,
    Stronghold,
    // Item variants
    Weapon,
    RingOfPower,
    Artifact,
    // Quote (standalone)
    Quote,
  ],
  resolveType: (val) => {
    if (val && typeof val === 'object') {
      const obj = val as { kind?: string; id?: string };
      if (obj.kind) {
        return obj.kind;
      }
      if (obj.id?.startsWith('q-')) {
        return 'Quote';
      }
    }
    return null;
  },
});

builder.queryFields((t) => ({
  search: t.field({
    type: [SearchResult],
    description: 'Case-insensitive substring search across canon names and quote text.',
    args: {
      term: t.arg.string({ required: true }),
      limit: t.arg.int({ defaultValue: 25 }),
    },
    resolve: (_root, args) => {
      const needle = args.term.trim().toLowerCase();
      if (!needle) {
        return [];
      }

      const hits: SearchHit[] = [];
      const push = (val: SearchHit) => {
        if (hits.length < (args.limit ?? 25)) {
          hits.push(val);
        }
      };

      for (const c of Characters.values()) {
        if (c.name.toLowerCase().includes(needle)) {
          push(c);
        }
      }
      for (const l of Locations.values()) {
        if (l.name.toLowerCase().includes(needle)) {
          push(l);
        }
      }
      for (const i of Items.values()) {
        if (i.name.toLowerCase().includes(needle)) {
          push(i);
        }
      }
      for (const q of Quotes.values()) {
        if (q.text.toLowerCase().includes(needle)) {
          push(q);
        }
      }

      return hits;
    },
  }),
}));
