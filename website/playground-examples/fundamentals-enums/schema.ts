import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

// #region alignment-enum
const Alignment = builder.enumType('Alignment', {
  description: "A faction's moral leaning.",
  values: ['Good', 'Neutral', 'Evil'],
});
// #endregion alignment-enum

interface IFaction {
  id: string;
  name: string;
  alignment: 'Good' | 'Neutral' | 'Evil';
}

const Factions: IFaction[] = [
  { id: '1', name: 'Fellowship of the Ring', alignment: 'Good' },
  { id: '2', name: 'Riders of Rohan', alignment: 'Good' },
  { id: '3', name: 'Uruk-hai', alignment: 'Evil' },
];

// #region using-alignment
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
// #endregion using-alignment

export const schema = builder.toSchema();
