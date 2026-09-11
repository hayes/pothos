import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://localhost:3000';
const root = join(process.cwd(), 'playground-examples');
const examples = [];
for (const entry of await readdir(root, { withFileTypes: true })) {
  if (!entry.isDirectory()) continue;
  const directory = join(root, entry.name);
  const metadata = JSON.parse(await readFile(join(directory, 'metadata.json'), 'utf8'));
  if (metadata.steps?.length) {
    for (const step of metadata.steps)
      examples.push({ id: `${metadata.id}-${step.id}`, directory: join(directory, step.id) });
  } else {
    examples.push({ id: metadata.id, directory });
    for (const variant of metadata.variants ?? []) {
      if (!variant.default)
        examples.push({
          id: `${metadata.id}-variant-${variant.id}`,
          directory: join(directory, `variant-${variant.id}`),
        });
    }
  }
}
assert.ok(examples.length, 'No playground examples found');
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
let operations = 0;
try {
  for (const example of examples) {
    const expected = JSON.parse(await readFile(join(example.directory, 'expected.json'), 'utf8'));
    const bundle = JSON.parse(
      await readFile(join('public/playground-examples', `${example.id}.json`), 'utf8'),
    );
    assert.deepEqual(
      Object.keys(expected).sort(),
      bundle.queries.map((query) => `${query.title}.graphql`).sort(),
      `${example.id}: every operation needs an expectation`,
    );
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`${origin}/playground?example=${encodeURIComponent(example.id)}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByRole('button', { name: /schema synced/ }).waitFor();
      for (const query of bundle.queries) {
        await page
          .getByRole('tablist', { name: 'Operations' })
          .getByRole('tab', { name: query.title, exact: true })
          .click();
        await page.getByRole('button', { name: /^Run query/ }).click();
        const output = page.getByLabel('GraphQL result').first();
        await output.filter({ hasText: /\S/ }).waitFor({ state: 'attached' });
        const result = JSON.parse(await output.textContent());
        // Error locations are source-layout details; preserve message/path/extensions.
        if (result.errors) result.errors = result.errors.map(({ locations, ...error }) => error);
        assert.deepEqual(
          result,
          expected[`${query.title}.graphql`],
          `${example.id}/${query.title}`,
        );
        operations++;
      }
      console.log(`PASS ${example.id}: ${bundle.queries.length} operation(s)`);
    } finally {
      await page.close();
    }
  }
} finally {
  await browser.close();
}
console.log(`PASS ${examples.length} examples/steps/variants; ${operations} browser operations`);
