import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
  raceId: string;
}

const characters: ICharacter[] = [
  { id: '1', name: 'Frodo Baggins', raceId: '1' },
  { id: '2', name: 'Samwise Gamgee', raceId: '1' },
  { id: '3', name: 'Aragorn', raceId: '2' },
  { id: '4', name: 'Legolas', raceId: '3' },
];

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

// #region characters-args
builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      args: {
        raceId: t.arg.string(),
        limit: t.arg.int({ required: true, defaultValue: 25 }),
        excludeIds: t.arg.idList({ required: true, defaultValue: [] }),
      },
      resolve: (_root, args) => {
        let result = characters;
        if (args.raceId) {
          result = result.filter((c) => c.raceId === args.raceId);
        }
        const excluded = new Set(args.excludeIds);
        return result.filter((c) => !excluded.has(c.id)).slice(0, args.limit);
      },
    }),
  }),
});
// #endregion characters-args

export const schema = builder.toSchema();
