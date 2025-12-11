import SchemaBuilder from '@pothos/core';

const builder = new SchemaBuilder<{
  Scalars: {
    PositiveInt: {
      Input: number;
      Output: number;
    };
    Date: {
      Input: Date;
      Output: Date;
    };
  };
}>({});

builder.scalarType('PositiveInt', {
  serialize: (n) => n,
  parseValue: (n) => {
    if (typeof n === 'number' && n >= 0) {
      return n;
    }

    throw new Error('Value must be positive');
  },
});

// Define a Date scalar for ISO date strings
const DateScalar = builder.scalarType('Date', {
  serialize: (value) => (value instanceof Date ? value.toISOString() : String(value)),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new Error('Date must be a string');
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      throw new Error('Date must be a valid ISO 8601 date string');
    }
    return date;
  },
});

builder.queryType({
  fields: (t) => ({
    // Field using PositiveInt scalar
    countdown: t.field({
      type: ['PositiveInt'],
      args: {
        from: t.arg({ type: 'PositiveInt', required: true }),
      },
      resolve: (_parent, { from }) => {
        const result: number[] = [];
        for (let i = from; i > 0; i--) {
          result.push(i);
        }
        return result;
      },
    }),

    // Field using Date scalar
    daysSince: t.int({
      args: {
        date: t.arg({ type: DateScalar, required: true }),
      },
      resolve: (_parent, { date }) => {
        const now = new Date();
        const diff = now.getTime() - date.getTime();
        return Math.floor(diff / (1000 * 60 * 60 * 24));
      },
    }),

    // Field that returns a Date
    now: t.field({
      type: DateScalar,
      resolve: () => new Date(),
    }),
  }),
});

export const schema = builder.toSchema();
