import SchemaBuilder from '@pothos/core';
import SimpleObjects from '@pothos/plugin-simple-objects';
import EdgeDBPlugin from '../../src';
import { db as edgeDBDriver } from './db';
import edgeDBQB, { types as EdgeDBTypes } from '../../dbschema/edgeql-js';

const builder = new SchemaBuilder<{
  Context: {
    user: { id: string };
  };
  Scalars: {
    ID: { Input: string; Output: string | number };
    DateTime: { Input: Date; Output: Date };
  };
  EdgeDBTypes: EdgeDBTypes;
}>({
  plugins: [EdgeDBPlugin, SimpleObjects],
  edgeDB: {
    qb: edgeDBQB,
    client: edgeDBDriver,
  },
});

builder.scalarType('DateTime', {
  serialize: (date) => date.toISOString(),
  parseValue: (date) => {
    if (typeof date !== 'string') {
      throw new Error('Unknown date value.');
    }

    return new Date(date);
  },
});

export default builder;
