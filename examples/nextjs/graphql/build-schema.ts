import { printSchema } from 'graphql';
import { schema } from './schema';
import { writeFileSync } from 'fs';

writeFileSync('schema.graphql', printSchema(schema));
