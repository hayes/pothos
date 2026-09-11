import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';

const origin = process.argv[2] ?? 'http://localhost:4341';
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
page.setDefaultTimeout(60000);
const sql = [];
page.on('console', (message) => {
  if (message.text().startsWith('SQL ')) {
    sql.push(message.text());
  }
});
const _edit = (filename, value) =>
  page.evaluate(
    ({ filename, value }) => {
      const model = window.monaco.editor
        .getModels()
        .find((model) => model.uri.path.endsWith(`/${filename}`));
      if (!model) {
        throw new Error(`Missing editor model ${filename}`);
      }
      model.setValue(value);
    },
    { filename, value },
  );
const edit = (filename, value) =>
  page.evaluate(
    ({ filename, value }) => {
      window.monaco.editor
        .getModel(window.monaco.Uri.parse(`file:///playground/${filename}`))
        .setValue(value);
    },
    { filename, value },
  );
const run = async () => {
  await page.getByRole('button', { name: /^Run query/ }).click();
  await page.getByRole('button', { name: /^Run query/ }).waitFor();
  const output = page.getByLabel('GraphQL result').first();
  await output.filter({ hasText: /\S/ }).waitFor({ state: 'attached' });
  return JSON.parse(await output.textContent());
};
try {
  await page.goto(`${origin}/playground?example=plugin-drizzle`);
  await page.getByRole('button', { name: /schema synced/ }).waitFor();
  await page.waitForFunction(() => window.monaco?.languages.typescript);
  await page.waitForTimeout(2000);
  const diagnostics = await page.evaluate(async () => {
    const monaco = window.monaco;
    const models = monaco.editor
      .getModels()
      .filter((model) => model.getLanguageId() === 'typescript');
    const worker = await (await monaco.languages.typescript.getTypeScriptWorker())(
      ...models.map((model) => model.uri),
    );
    const errors = [];
    for (const model of models) {
      for (const diagnostic of [
        ...(await worker.getSyntacticDiagnostics(model.uri.toString())),
        ...(await worker.getSemanticDiagnostics(model.uri.toString())),
      ]) {
        if (diagnostic.category === 1) {
          errors.push({
            file: model.uri.path,
            code: diagnostic.code,
            message: diagnostic.messageText,
          });
        }
      }
    }
    return errors;
  });
  assert.deepEqual(diagnostics, [], 'editor types');
  const bundle = JSON.parse(
    await readFile(
      new URL('../public/playground-examples/plugin-drizzle.json', import.meta.url),
      'utf8',
    ),
  );
  const results = {};
  for (const query of bundle.queries) {
    await page
      .getByRole('tablist', { name: 'Operations' })
      .getByRole('tab', { name: query.title, exact: true })
      .click();
    sql.length = 0;
    const result = await run();
    assert.equal(result.errors, undefined, JSON.stringify(result.errors));
    results[`${query.title}.graphql`] = result;
    if (query.title === '01-author') {
      assert.equal(sql.length, 1, 'nested author and posts are loaded by one SQL query');
    }
    if (query.title === '02-aliases') {
      assert.equal(sql.length, 2, 'incompatible aliases require a fallback query');
      assert.deepEqual(result.data.author.newest, [...result.data.author.oldest].reverse());
    }
    console.log('PASS', query.title);
  }
  if (process.env.UPDATE_DATABASE_EXPECTATIONS === '1') {
    await writeFile(
      new URL('../playground-examples/plugin-drizzle/expected.json', import.meta.url),
      `${JSON.stringify(results, null, 2)}\n`,
    );
  } else {
    assert.deepEqual(
      results,
      JSON.parse(
        await readFile(
          new URL('../playground-examples/plugin-drizzle/expected.json', import.meta.url),
          'utf8',
        ),
      ),
    );
  }
  const operation = async (title) => {
    await page
      .getByRole('tablist', { name: 'Operations' })
      .getByRole('tab', { name: title, exact: true })
      .click();
  };
  const pane = async (name, text) => {
    await page
      .getByRole('tablist', { name: 'Operation panes' })
      .getByRole('tab', { name: new RegExp(`^${name}`) })
      .click();
    await page.waitForFunction(
      (language) =>
        window.monaco.editor
          .getEditors()
          .some(
            (editor) =>
              editor.getModel()?.getLanguageId() === language &&
              editor.getDomNode()?.offsetParent !== null &&
              !editor.getOption(window.monaco.editor.EditorOption.readOnly),
          ),
      name === 'Query' ? 'graphql' : 'json',
    );
    await page.evaluate(
      ({ language, text }) => {
        const editor = window.monaco.editor
          .getEditors()
          .find(
            (editor) =>
              editor.getModel()?.getLanguageId() === language &&
              editor.getDomNode()?.offsetParent !== null &&
              !editor.getOption(window.monaco.editor.EditorOption.readOnly),
          );
        editor.getModel().setValue(text);
      },
      { language: name === 'Query' ? 'graphql' : 'json', text },
    );
    await page.waitForTimeout(250);
  };
  await operation('04-pagination');
  const first = results['04-pagination.graphql'].data.posts;
  await pane('Variables', JSON.stringify({ after: first.pageInfo.endCursor }));
  const next = await run();
  assert.equal(next.errors, undefined);
  assert.deepEqual(
    next.data.posts.nodes.map((post) => post.title),
    ['Starting a seed library'],
  );
  assert.equal(next.data.posts.pageInfo.hasNextPage, false);
  await pane(
    'Query',
    `query { posts(last: 1, before: "${first.pageInfo.endCursor}") { nodes { title } } }`,
  );
  assert.deepEqual((await run()).data.posts.nodes, [{ title: 'Watering through summer' }]);
  await pane(
    'Query',
    `query { posts(first: 2, after: "${next.data.posts.pageInfo.endCursor}") { nodes { title } pageInfo { hasNextPage } } }`,
  );
  assert.deepEqual((await run()).data.posts.nodes, []);
  await pane('Query', '{ author(id: 1) { postsConnection { totalCount } } }');
  sql.length = 0;
  assert.deepEqual((await run()).data, { author: { postsConnection: { totalCount: 2 } } });
  assert.ok(
    sql.length > 0 && sql.some((statement) => /count\(/i.test(statement)),
    'count-only selection reaches SQL',
  );
  await operation('03-viewer');
  await pane('Context', '{"userId":2}');
  const leo = await run();
  assert.equal(leo.data.me.__typename, 'AuthorViewer');
  assert.deepEqual(leo.data.me.drafts, [{ title: 'Saving rainwater' }]);
  await pane('Context', '{"userId":999}');
  assert.deepEqual((await run()).data, { me: null });
  await operation('01-author');
  const database = bundle.files.find((file) => file.filename === 'database.ts').content;
  await page.getByRole('button', { name: 'database.ts', exact: true }).click();
  await edit('database.ts', database.replace('Maya', 'Amaya'));
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /schema synced/ }).waitFor();
  assert.equal((await run()).data.author.fullName, 'Amaya Chen');
  await page.context().grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  await page.getByRole('button', { name: 'Copied!', exact: true }).waitFor();
  const sharedUrl = await page.evaluate(() => navigator.clipboard.readText());
  const shared = await browser.newPage();
  shared.setDefaultTimeout(60000);
  try {
    await shared.goto(sharedUrl);
    await shared.getByRole('button', { name: 'Trust and build schema', exact: true }).click();
    await shared.getByRole('button', { name: /schema synced/ }).waitFor();
    await shared.getByRole('button', { name: /^Run query/ }).click();
    await shared
      .getByLabel('GraphQL result')
      .first()
      .filter({ hasText: 'Amaya Chen' })
      .waitFor({ state: 'attached' });
  } finally {
    await shared.close();
  }

  await page.getByRole('button', { name: 'Reset example', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /schema synced/ }).waitFor();
  assert.equal((await run()).data.author.fullName, 'Maya Chen');
  console.log(
    'PASS cursor continuation, backward/empty pages, count-only SQL, viewer isolation, seed edit and reset',
  );
  await page.getByRole('button', { name: 'schema.ts', exact: true }).click();
  const schemaSource = bundle.files.find((file) => file.filename === 'schema.ts').content;
  await edit(
    'schema.ts',
    schemaSource.replace("t.exposeString('firstName')", "t.exposeString('notAColumn')"),
  );
  await page.waitForFunction(async () => {
    const monaco = window.monaco;
    const uri = monaco.Uri.parse('file:///playground/schema.ts');
    const worker = await (await monaco.languages.typescript.getTypeScriptWorker())(uri);
    return (await worker.getSemanticDiagnostics(uri.toString())).some(
      (diagnostic) => diagnostic.code === 2345 || diagnostic.code === 2322,
    );
  });
  await page.getByRole('button', { name: 'Reset example', exact: true }).click();
  await page.waitForTimeout(1000);
  await page.getByRole('button', { name: /schema synced/ }).waitFor();
  console.log('PASS shared edited database and unknown-column type rejection');
  await page.screenshot({ path: '/tmp/pothos-drizzle-browser.png' });
  for (const [route, checks] of [
    ['objects', ['author']],
    ['relations', ['author', 'media']],
    ['variants', ['viewer']],
    ['connections', ['posts']],
  ]) {
    const docs = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    docs.setDefaultTimeout(60000);
    try {
      await docs.goto(`${origin}/docs/plugins/drizzle/${route}`);
      for (const [index, check] of checks.entries()) {
        await docs
          .getByRole('button', { name: 'Open in Playground', exact: true })
          .nth(index)
          .click();
        const frame = docs.frameLocator('iframe[title="Pothos Playground"]');
        await frame.getByRole('button', { name: /schema synced/ }).waitFor();
        await frame.getByRole('button', { name: /^Run query/ }).click();
        const output = frame.getByLabel('GraphQL result').first();
        await output
          .filter({ hasText: /Maya|composting|EditorViewer/ })
          .waitFor({ state: 'attached' });
        const result = JSON.parse(await output.textContent());
        assert.equal(result.errors, undefined);
        if (check === 'viewer') {
          assert.equal(result.data.me.__typename, 'EditorViewer');
        }
        if (check === 'posts') {
          assert.equal(result.data.posts.nodes.length, 2);
        }
        if (check === 'author') {
          assert.equal(result.data.author.fullName, 'Maya Chen');
        }
        if (check === 'media') {
          assert.equal(result.data.author.posts.length, 2);
          for (const post of result.data.author.posts) {
            assert.equal(post.media[0].uploadedBy.fullName, 'Leo Silva');
            assert.equal(post.mediaConnection.totalCount, 1);
          }
        }
        await docs.getByRole('button', { name: 'Close playground', exact: true }).click();
      }
      console.log('PASS rendered actions', route);
    } finally {
      await docs.close();
    }
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${origin}/docs/plugins/drizzle/objects`);
  await page.getByRole('button', { name: 'Open in Playground', exact: true }).click();
  const mobile = page.frameLocator('iframe[title="Pothos Playground"]');
  await mobile.getByRole('button', { name: /schema synced/ }).waitFor();
  const runButton = mobile.getByRole('button', { name: /^Run query/ });
  const bounds = await runButton.boundingBox();
  assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390);
  await runButton.click();
  await mobile
    .getByLabel('GraphQL result')
    .first()
    .filter({ hasText: 'Maya Chen' })
    .waitFor({ state: 'attached' });
  await page.screenshot({ path: '/tmp/pothos-drizzle-mobile.png' });
  console.log('PASS mobile docs action, query and result');
} finally {
  await browser.close();
}
