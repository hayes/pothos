import SchemaBuilder from '@pothos/core';

interface IBattle {
  id: number;
  name: string;
  location: string;
  foughtOn: Date;
}

const Battles: IBattle[] = [
  {
    id: 1,
    name: 'Battle of the Hornburg',
    location: "Helm's Deep",
    foughtOn: new Date('3019-03-03T22:00:00Z'),
  },
  {
    id: 2,
    name: 'Battle of the Pelennor Fields',
    location: 'Minas Tirith',
    foughtOn: new Date('3019-03-15T06:00:00Z'),
  },
];

// Custom scalars are registered in the builder generic, then defined
// with builder.scalarType. The Input/Output split lets you accept and
// emit different shapes (e.g. parse a string into a Date).
const builder = new SchemaBuilder<{
  Scalars: {
    DateTime: { Input: Date; Output: Date };
  };
}>({});

builder.scalarType('DateTime', {
  serialize: (value) => value.toISOString(),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new Error('DateTime must be an ISO 8601 string');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Invalid DateTime');
    }
    return date;
  },
});

const Battle = builder.objectRef<IBattle>('Battle').implement({
  fields: (t) => ({
    id: t.exposeID('id'),
    name: t.exposeString('name'),
    location: t.exposeString('location'),
    foughtOn: t.field({ type: 'DateTime', resolve: (b) => b.foughtOn }),
  }),
});

builder.queryType({
  fields: (t) => ({
    battlesSince: t.field({
      type: [Battle],
      args: { after: t.arg({ type: 'DateTime' }) },
      resolve: (_root, { after }) =>
        Battles.filter((b) => !after || b.foughtOn >= after),
    }),
  }),
});

export const schema = builder.toSchema();
