import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { printSchema } from 'graphql';
import { schema } from '../src/schema/index.ts';

const __dirname = dirname(fileURLToPath(import.meta.url));

writeFileSync(resolve(__dirname, '../schema.graphql'), printSchema(schema));
