import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { checkPlaygroundMobile } from './check-playground-mobile.mjs';
import { checkPlaygroundProject } from './check-playground-project.mjs';
import { checkPlaygroundTabs } from './check-playground-tabs.mjs';
import { loadPlaygroundCases } from './playground-cases.mjs';

const origin = process.argv[2] ?? 'http://localhost:3000';
const examples = await loadPlaygroundCases();
const browser = await chromium.launch({
  headless: true,
  ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
    ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
    : {}),
});
let operations = 0;
try {
  for (const example of examples) {
    const { expected, bundle } = example;
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`${origin}/playground?example=${encodeURIComponent(example.id)}`, {
        waitUntil: 'domcontentloaded',
      });
      await page.getByRole('button', { name: /schema synced/ }).waitFor();
      await page.waitForFunction(() => window.monaco?.languages.typescript);
      // Monaco debounces marker updates after loading a project's files.
      // Check both fresh worker diagnostics and the errors readers actually see.
      await page.waitForTimeout(1500);
      const diagnostics = await page.evaluate(async () => {
        const monaco = window.monaco;
        const models = monaco.editor
          .getModels()
          .filter((model) => model.getLanguageId() === 'typescript');
        const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
        const worker = await getWorker(...models.map((model) => model.uri));
        const errors = [];
        for (const model of models) {
          const path = model.uri.toString();
          for (const diagnostic of [
            ...(await worker.getSyntacticDiagnostics(path)),
            ...(await worker.getSemanticDiagnostics(path)),
          ]) {
            if (diagnostic.category === 1) {
              errors.push({ path, code: diagnostic.code, message: diagnostic.messageText });
            }
          }
          for (const marker of monaco.editor.getModelMarkers({ resource: model.uri })) {
            if (marker.severity === monaco.MarkerSeverity.Error) {
              errors.push({ path, code: marker.code, message: marker.message });
            }
          }
        }
        return errors;
      });
      assert.deepEqual(diagnostics, [], `${example.id}: editor TypeScript diagnostics`);
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
        if (result.errors) {
          result.errors = result.errors.map(({ locations, ...error }) => error);
        }
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
  await checkPlaygroundMobile(browser, origin);
  await checkPlaygroundProject(browser, origin);
  await checkPlaygroundTabs(browser, origin, examples);
} finally {
  await browser.close();
}
console.log(`PASS ${examples.length} examples/steps/variants; ${operations} browser operations`);
