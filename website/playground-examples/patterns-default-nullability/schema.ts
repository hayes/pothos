import SchemaBuilder from '@pothos/core';

interface IRace {
  id: string;
  name: string;
  motto?: string;
}

const Races: IRace[] = [
  { id: 'hobbit', name: 'Hobbit', motto: 'Second breakfast is sacred.' },
  { id: 'elf', name: 'Elf' },
];

// Pothos defaults fields to nullable. To flip them all to non-nullable
// you set the generic AND the matching runtime option — both have to
// agree so the SDL and TypeScript inference stay in sync.
const builder = new SchemaBuilder<{
  DefaultFieldNullability: false;
}>({
  defaultFieldNullability: false,
});

const Race = builder.objectRef<IRace>('Race').implement({
  fields: (t) => ({
    // Non-nullable now, so SDL reads `id: ID!`.
    id: t.exposeID('id'),
    name: t.exposeString('name'),

    // Opt back into nullable for genuinely optional fields.
    motto: t.exposeString('motto', { nullable: true }),
  }),
});

builder.queryType({
  fields: (t) => ({
    races: t.field({
      type: [Race],
      resolve: () => Races,
    }),
  }),
});

export const schema = builder.toSchema();
