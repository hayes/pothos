import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { printSchema } from 'graphql';
import { schema } from '../src/schema';

writeFileSync(resolve(module.filename, '../../schema.graphql'), printSchema(schema));
