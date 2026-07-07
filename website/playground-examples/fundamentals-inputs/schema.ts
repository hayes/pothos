import SchemaBuilder from '@pothos/core';

interface CharacterShape {
  id: string;
  name: string;
  birthYear?: number;
}

interface FactionShape {
  id: string;
  name: string;
  alignment: string;
  memberIds: string[];
}

const characters: CharacterShape[] = [
  { id: '1', name: 'Frodo', birthYear: 2968 },
  { id: '2', name: 'Aragorn', birthYear: 2931 },
];
let nextCharacterId = 3;

const factions: FactionShape[] = [
  { id: '1', name: 'Fellowship of the Ring', alignment: 'Good', memberIds: ['1', '2'] },
  { id: '2', name: 'Uruk-hai', alignment: 'Evil', memberIds: [] },
];

function addCharacter(input: { name: string; birthYear?: number | null }): CharacterShape {
  const character: CharacterShape = {
    id: String(nextCharacterId++),
    name: input.name,
    birthYear: input.birthYear ?? undefined,
  };
  characters.push(character);
  return character;
}

function findFactions(filter?: { nameContains?: string | null; minMembers?: number | null } | null) {
  return factions.filter(
    (faction) =>
      (!filter?.nameContains || faction.name.includes(filter.nameContains)) &&
      (filter?.minMembers == null || faction.memberIds.length >= filter.minMembers),
  );
}

const builder = new SchemaBuilder({});

const Character = builder.objectRef<CharacterShape>('Character').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    birthYear: t.exposeInt('birthYear', { nullable: true }),
  }),
});

const Faction = builder.objectRef<FactionShape>('Faction').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    alignment: t.exposeString('alignment'),
  }),
});

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => characters,
    }),
  }),
});

// #region add-character-mutation
builder.mutationType({
  fields: (t) => ({
    addCharacter: t.field({
      type: Character,
      args: {
        input: t.arg({
          type: builder.inputType('AddCharacterInput', {
            fields: (t) => ({
              name: t.string({ required: true }),
              birthYear: t.int(),
            }),
          }),
          required: true,
        }),
      },
      resolve: (_root, { input }) => addCharacter(input),
    }),
  }),
});
// #endregion add-character-mutation

// #region shared
const FactionFilter = builder.inputType('FactionFilter', {
  fields: (t) => ({
    nameContains: t.string(),
    minMembers: t.int(),
  }),
});

builder.queryFields((t) => ({
  factions: t.field({
    type: [Faction],
    args: { filter: t.arg({ type: FactionFilter }) },
    resolve: (_root, { filter }) => findFactions(filter),
  }),
  factionCount: t.int({
    args: { filter: t.arg({ type: FactionFilter }) },
    resolve: (_root, { filter }) => findFactions(filter).length,
  }),
}));
// #endregion shared

// #region nested
const CharacterFilter = builder.inputType('CharacterFilter', {
  fields: (t) => ({
    nameContains: t.string(),
    faction: t.field({ type: FactionFilter }),
  }),
});
// #endregion nested

builder.queryFields((t) => ({
  findCharacters: t.field({
    type: [Character],
    args: { filter: t.arg({ type: CharacterFilter }) },
    resolve: () => characters,
  }),
}));

// #region recursive
interface CharacterQueryInput {
  and?: CharacterQueryInput[];
  nameContains?: string;
  bornAfter?: number;
}

const CharacterQuery = builder.inputRef<CharacterQueryInput>('CharacterQuery');

CharacterQuery.implement({
  fields: (t) => ({
    and: t.field({ type: [CharacterQuery] }),
    nameContains: t.string(),
    bornAfter: t.int(),
  }),
});
// #endregion recursive

builder.queryFields((t) => ({
  searchCharacters: t.field({
    type: [Character],
    args: { query: t.arg({ type: CharacterQuery }) },
    resolve: () => characters,
  }),
}));

export const schema = builder.toSchema();
