import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';

export async function loadPlaygroundCases() {
  const root = join(process.cwd(), 'playground-examples');
  const examples = [];
  for (const entry of await readdir(root, { withFileTypes: true })) {
    if (!entry.isDirectory()) {
      continue;
    }
    const directory = join(root, entry.name);
    const metadata = JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8'));
    if (metadata.steps?.length) {
      for (const step of metadata.steps) {
        examples.push({ id: `${metadata.id}-${step.id}`, directory: join(directory, step.id) });
      }
    } else {
      examples.push({ id: metadata.id, directory });
      for (const variant of metadata.variants ?? []) {
        if (!variant.default) {
          examples.push({
            id: `${metadata.id}-variant-${variant.id}`,
            directory: join(directory, `variant-${variant.id}`),
          });
        }
      }
    }
  }
  assert.ok(examples.length, 'No playground examples found');
  return Promise.all(
    examples.map(async (example) => {
      const expected = JSON.parse(await readFile(join(example.directory, 'expected.json'), 'utf8'));
      const bundle = JSON.parse(
        await readFile(join('public/playground-examples', `${example.id}.json`), 'utf8'),
      );
      assert.ok(bundle.queries?.length, `${example.id}: no operations`);
      assert.deepEqual(
        Object.keys(expected).sort(),
        bundle.queries.map((query) => `${query.title}.graphql`).sort(),
        `${example.id}: every operation needs an expectation`,
      );
      return { ...example, expected, bundle };
    }),
  );
}
