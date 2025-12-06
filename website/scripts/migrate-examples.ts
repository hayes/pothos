#!/usr/bin/env tsx

/**
 * Migration script to convert inline TypeScript examples to file-based structure
 * This reads the existing example files and extracts them to separate files
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';

// Import existing examples
import { basicTypesExample } from '../components/playground/examples/basic-types';
import { mutationsExample } from '../components/playground/examples/mutations';
import { interfacesExample } from '../components/playground/examples/interfaces';
import { enumsArgsExample } from '../components/playground/examples/enums-args';
import { unionsExample } from '../components/playground/examples/unions';
import { simpleObjectsPluginExample } from '../components/playground/examples/simple-objects-plugin';
import { relayPluginExample } from '../components/playground/examples/relay-plugin';
import { withInputPluginExample } from '../components/playground/examples/with-input-plugin';

const examples = [
  basicTypesExample,
  mutationsExample,
  interfacesExample,
  enumsArgsExample,
  unionsExample,
  simpleObjectsPluginExample,
  relayPluginExample,
  withInputPluginExample,
];

const EXAMPLES_BASE = join(process.cwd(), 'public', 'playground-examples');

async function migrateExample(example: typeof examples[0]) {
  const exampleDir = join(EXAMPLES_BASE, example.id);

  // Create directory
  await mkdir(exampleDir, { recursive: true });

  // Write metadata.json
  const metadata = {
    id: example.id,
    title: example.title,
    description: example.description,
    tags: [] as string[],
  };

  await writeFile(
    join(exampleDir, 'metadata.json'),
    JSON.stringify(metadata, null, 2),
    'utf-8'
  );

  // Write schema.ts (first file, which is always the schema)
  const schemaFile = example.files[0];
  await writeFile(
    join(exampleDir, 'schema.ts'),
    schemaFile.content,
    'utf-8'
  );

  // Write query.graphql
  await writeFile(
    join(exampleDir, 'query.graphql'),
    example.defaultQuery,
    'utf-8'
  );

  console.log(`✓ Migrated ${example.id}`);
}

async function migrate() {
  console.log('[Migrate] Starting migration...');

  for (const example of examples) {
    try {
      await migrateExample(example);
    } catch (err) {
      console.error(`✗ Failed to migrate ${example.id}:`, err);
    }
  }

  console.log('[Migrate] Done! Run build-playground-examples.ts to generate the bundle.');
}

migrate().catch(err => {
  console.error('[Migrate] Fatal error:', err);
  process.exit(1);
});
