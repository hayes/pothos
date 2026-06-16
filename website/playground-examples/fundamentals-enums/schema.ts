import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// Object-form enum: values are defined inline. The `as const` lets
// Pothos infer the literal union for use as a TypeScript type.
const Alignment = builder.enumType('Alignment', {
  description: "A faction's moral leaning.",
  values: ['Good', 'Neutral', 'Evil'] as const,
});

interface IFaction {
  id: string;
  name: string;
  alignment: 'Good' | 'Neutral' | 'Evil';
}

const Factions: IFaction[] = [
  { id: 'fellowship', name: 'Fellowship of the Ring', alignment: 'Good' },
  { id: 'rohirrim', name: 'Riders of Rohan', alignment: 'Good' },
  { id: 'uruk-hai', name: 'Uruk-hai', alignment: 'Evil' },
];

const Faction = builder.objectRef<IFaction>('Faction').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    alignment: t.field({ type: Alignment, resolve: (f) => f.alignment }),
  }),
});

builder.queryType({
  fields: (t) => ({
    factions: t.field({
      type: [Faction],
      args: { alignment: t.arg({ type: Alignment }) },
      resolve: (_root, args) =>
        args.alignment ? Factions.filter((f) => f.alignment === args.alignment) : Factions,
    }),
  }),
});

export const schema = builder.toSchema();
