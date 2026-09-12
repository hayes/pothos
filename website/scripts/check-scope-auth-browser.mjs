import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://localhost:4342';
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(60000);
const guide = await readFile(
  new URL('../content/docs/plugins/scope-auth/relay-nodes.mdx', import.meta.url),
  'utf8',
);
const actions = [...guide.matchAll(/<include[^>]*meta='([^']+)'[^>]*>([^<#]+)#[^<]+<\/include>/g)];
assert.equal(actions.length, 6, 'every policy and node excerpt opens its example');
try {
  await page.goto(`${origin}/docs/plugins/scope-auth/relay-nodes`);
  for (const [index, [, meta, source]] of actions.entries()) {
    const id = meta.match(/example="([^"]+)"/)[1];
    const operation = Number(meta.match(/op="(\d+)"/)[1]);
    const bundle = JSON.parse(
      await readFile(new URL(`../public/playground-examples/${id}.json`, import.meta.url), 'utf8'),
    );
    const query = bundle.queries[operation - 1];
    const filename = source.replace(
      /^playground-examples\/plugin-scope-auth\/(variant-private-nodes\/)?/,
      '',
    );
    await page.getByRole('button', { name: 'Open in Playground', exact: true }).nth(index).click();
    const frame = page.frameLocator('iframe[title="Pothos Playground"]');
    await frame.getByRole('button', { name: /schema synced/ }).waitFor();
    await frame
      .getByRole('tab', { name: query.title, exact: true })
      .and(frame.locator('[aria-selected="true"]'))
      .waitFor();
    const runtime = page.frames().find((candidate) => candidate.url().includes('/playground?'));
    const launchURL = await page.locator('iframe[title="Pothos Playground"]').getAttribute('src');
    assert.equal(new URL(launchURL, origin).searchParams.get('op'), String(operation));
    await runtime.waitForFunction(
      (filename) =>
        window.monaco.editor.getEditors().some(
          (editor) =>
            editor.getModel()?.uri.path === `/playground/${filename}` &&
            editor.getDomNode()?.offsetParent !== null &&
            editor
              .getModel()
              .getAllDecorations()
              .some((decoration) => decoration.options.className === 'playground-source-highlight'),
        ),
      filename,
    );
    await frame.getByRole('button', { name: /^Run query/ }).click();
    const output = frame.getByLabel('GraphQL result').first();
    await output.filter({ hasText: /Publishing API|A field guide/ }).waitFor({ state: 'attached' });
    const result = JSON.parse(await output.textContent());
    const signedOut = id.endsWith('private-nodes') ? operation === 1 : operation === 8;
    if (signedOut) {
      assert.equal(result.data.node, null);
      assert.ok(result.errors.some((error) => error.message === 'Not authorized'));
    } else {
      assert.equal(result.errors, undefined);
      assert.equal(result.data.node.title, 'A field guide to GraphQL');
    }
    if (id.endsWith('private-nodes')) {
      assert.equal(result.data.serviceName, 'Publishing API');
    } else if (operation === 8) {
      assert.equal(result.data.featuredArticle.title, 'A field guide to GraphQL');
    }
    await page.getByRole('button', { name: 'Close playground', exact: true }).click();
    console.log('PASS Scope Auth snippet', index + 1, id, query.title);
  }
} finally {
  await browser.close();
}
