// #region greeting
import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder({});

builder.queryType({
  fields: (t) => ({
    greeting: t.string({
      args: {
        name: t.arg({ type: 'String', required: true }),
      },
      resolve: (_parent, args) => `Hello, ${args.name}!`,
    }),
  }),
});
// #endregion greeting

// #region defaults
builder.queryField('repeat', (t) =>
  t.string({
    args: {
      text: t.arg.string({ required: true }),
      times: t.arg.int({ defaultValue: 2 }),
    },
    resolve: (_parent, args) => args.text.repeat(Math.max(0, args.times ?? 1)),
  }),
);
// #endregion defaults

// #region lists
builder.queryField('knownGiraffes', (t) =>
  t.stringList({
    args: {
      names: t.arg.stringList({ required: true }),
      moreNames: t.arg({ type: ['String'], required: true }),
    },
    resolve: (_parent, args) =>
      [...args.names, ...args.moreNames].filter((name) => ['Gina', 'James'].includes(name)),
  }),
);
// #endregion lists

// #region nullable-items
builder.queryField('nonNullNames', (t) =>
  t.stringList({
    args: {
      names: t.arg.stringList({
        required: { list: true, items: false },
      }),
    },
    resolve: (_parent, args) => args.names.filter((name) => name != null),
  }),
);
// #endregion nullable-items

// #region enum
const LengthUnit = builder.enumType('LengthUnit', {
  values: { Feet: {}, Meters: {} },
});

const GiraffeRef = builder.objectRef<{ heightInMeters: number }>('Giraffe').implement({
  fields: (t) => ({
    height: t.float({
      args: {
        unit: t.arg({ type: LengthUnit, defaultValue: 'Meters' }),
      },
      resolve: (giraffe, args) =>
        args.unit === 'Feet' ? giraffe.heightInMeters * 3.281 : giraffe.heightInMeters,
    }),
  }),
});

builder.queryField('giraffe', (t) =>
  t.field({
    type: GiraffeRef,
    resolve: () => ({ heightInMeters: 5 }),
  }),
);
// #endregion enum

// #region nested-lists
builder.queryField('countNames', (t) =>
  t.int({
    args: {
      groups: t.arg({
        type: t.arg.listRef(t.arg.listRef('String', { required: false })),
        required: true,
      }),
    },
    resolve: (_parent, args) =>
      args.groups.reduce((count, group) => count + group.filter((name) => name != null).length, 0),
  }),
);

export const schema = builder.toSchema();
// #endregion nested-lists
