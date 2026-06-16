import SchemaBuilder from '@pothos/core';

interface ICharacter {
  id: string;
  name: string;
  raceId: string;
}

const Characters: ICharacter[] = [
  { id: 'frodo', name: 'Frodo Baggins', raceId: 'hobbit' },
  { id: 'sam', name: 'Samwise Gamgee', raceId: 'hobbit' },
  { id: 'aragorn', name: 'Aragorn', raceId: 'man' },
  { id: 'legolas', name: 'Legolas', raceId: 'elf' },
];

const builder = new SchemaBuilder({});

const Character = builder.objectRef<ICharacter>('Character');

Character.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

builder.queryType({
  fields: (t) => ({
    characters: t.field({
      type: [Character],
      args: {
        // Optional arg. Pothos defaults arguments to nullable, matching
        // GraphQL's behaviour when `required` is not set.
        raceId: t.arg.string(),

        // Required arg with a default. The resolver sees `limit: number`.
        limit: t.arg.int({ required: true, defaultValue: 25 }),

        // List arg, required with a default. `required` flips the type
        // from `(readonly string[] | null | undefined)` to `readonly string[]`.
        excludeIds: t.arg.idList({ required: true, defaultValue: [] }),
      },
      resolve: (_root, args) => {
        let result = Characters;
        if (args.raceId) {
          result = result.filter((c) => c.raceId === args.raceId);
        }
        const excluded = new Set(args.excludeIds.map(String));
        return result.filter((c) => !excluded.has(c.id)).slice(0, args.limit);
      },
    }),
  }),
});

export const schema = builder.toSchema();
