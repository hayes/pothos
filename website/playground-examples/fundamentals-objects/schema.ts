import SchemaBuilder from '@pothos/core';

// #region character-model
interface ICharacter {
  id: string;
  name: string;
  birthYear?: string;
  biography?: string;
  editorId: string;
}
// #endregion character-model

interface IRace {
  id: string;
  name: string;
  lifespan: string;
}

const characters = new Map<string, ICharacter>([
  ['1', { id: '1', name: 'Frodo Baggins', birthYear: 'TA 2968', editorId: '1' }],
  ['2', { id: '2', name: 'Samwise Gamgee', birthYear: 'TA 2980', editorId: '1' }],
  ['3', { id: '3', name: 'Gandalf', editorId: '2' }],
]);

const races = new Map<string, IRace>([
  ['1', { id: '1', name: 'Hobbit', lifespan: 'About 100 years' }],
  ['2', { id: '2', name: 'Wizard', lifespan: 'Immortal' }],
]);

const builder = new SchemaBuilder({});

// #region character-ref
const Character = builder.objectRef<ICharacter>('Character');
// #endregion character-ref

// #region character-implement
Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});
// #endregion character-implement

// #region race
const Race = builder.objectRef<IRace>('Race').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    lifespan: t.exposeString('lifespan'),
  }),
});
// #endregion race

// #region query
builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      resolve: () => [...characters.values()],
    }),
    races: t.field({
      type: [Race],
      resolve: () => [...races.values()],
    }),
  }),
});
// #endregion query

export const schema = builder.toSchema();
