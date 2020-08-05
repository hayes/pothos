import { DateResolver } from 'graphql-scalars';
import builder from './builder';

builder.addScalarType('Date', DateResolver, {});

builder.scalarType('PositiveInt', {
  serialize: (n) => n as number,
  parseValue: (n) => {
    if (n >= 0) {
      return n as number;
    }

    throw new Error('Value must be positive');
  },
});

builder.queryFields((t) => ({
  date: t.field({
    type: 'Date',
    resolve: () => new Date(2012, 11, 12),
  }),

  positive: t.field({
    type: 'PositiveInt',
    resolve: () => 5,
  }),
}));
