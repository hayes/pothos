import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { printSchema } from 'graphql';
import { schema } from '../src/schema';

writeFileSync(resolve(module.filename, '../../schema.graphql'), printSchema(schema));
