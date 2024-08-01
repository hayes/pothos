import { writeFileSync } from 'node:fs';
import { printSchema } from 'graphql';
import { schema } from './schema';

writeFileSync('schema.graphql', printSchema(schema));
