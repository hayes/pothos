import './comment';
import './post';
import './user';
import './query';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printSchema } from 'graphql';
import { DateTimeResolver } from 'graphql-scalars';
import { builder } from '../builder';

builder.mutationType({});
builder.addScalarType('DateTime', DateTimeResolver);

export const schema = builder.toSchema();

// eslint-disable-next-line unicorn/prefer-module
writeFileSync(resolve(__dirname, '../schema.graphql'), printSchema(schema));
