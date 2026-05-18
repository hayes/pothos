import SchemaBuilder from '@pothos/core';

interface IRace {
  id: string;
  name: string;
}

const Races: IRace[] = [
  { id: 'hobbit', name: 'Hobbit' },
  { id: 'elf', name: 'Elf' },
  { id: 'man', name: 'Man' },
];

const builder = new SchemaBuilder({});

const Race = builder.objectRef<IRace>('Race');

Race.implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
  }),
});

// queryType defines the Query root and any number of fields on it.
// Call it exactly once per schema.
builder.queryType({
  fields: (t) => ({
    races: t.field({
      type: [Race],
      resolve: () => Races,
    }),
  }),
});

// queryField adds a single field to the Query root from anywhere else
// in your codebase. Use this when you want to colocate query entry
// points with the type they return.
builder.queryField('raceById', (t) =>
  t.field({
    type: Race,
    nullable: true,
    args: { id: t.arg.id({ required: true }) },
    resolve: (_root, { id }) => Races.find((r) => r.id === String(id)) ?? null,
  }),
);

// queryFields adds several fields in one call. Pick whichever fits the
// shape of the surrounding module.
builder.queryFields((t) => ({
  raceCount: t.int({
    resolve: () => Races.length,
  }),
}));

export const schema = builder.toSchema();
