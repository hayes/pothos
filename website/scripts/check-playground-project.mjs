import assert from 'node:assert/strict';

/** Check replacement of a project while a file removed by the next step is open. */
export async function checkPlaygroundProject(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(60000);
  try {
    await page.goto(`${origin}/playground?example=playground-tour&step=2`);
    await page.getByRole('button', { name: /schema synced/ }).waitFor();
    await page.getByRole('button', { name: 'models/giraffe.ts', exact: true }).click();
    await page.waitForFunction(() =>
      window.monaco?.editor
        .getEditors()
        .some(
          (editor) => editor.getModel()?.uri.toString() === 'file:///playground/models/giraffe.ts',
        ),
    );
    await page.getByRole('button', { name: '← Prev', exact: true }).click();
    await page.getByRole('button', { name: 'models/giraffe.ts', exact: true }).waitFor({
      state: 'detached',
    });
    await page.waitForFunction(() => {
      const monaco = window.monaco;
      return !monaco.editor.getModel(monaco.Uri.parse('file:///playground/models/giraffe.ts'));
    });
    await page.getByRole('button', { name: 'schema.ts', exact: true }).click();
    await page.evaluate(() => {
      const monaco = window.monaco;
      monaco.editor
        .getModel(monaco.Uri.parse('file:///playground/schema.ts'))
        .setValue("import { giraffes } from './models/giraffe';\nexport const removed = giraffes;");
    });
    await page.waitForFunction(async () => {
      try {
        const monaco = window.monaco;
        const uri = monaco.Uri.parse('file:///playground/schema.ts');
        const getWorker = await monaco.languages.typescript.getTypeScriptWorker();
        const worker = await getWorker(uri);
        const diagnostics = await worker.getSemanticDiagnostics(uri.toString());
        const markers = monaco.editor.getModelMarkers({ resource: uri });
        return (
          diagnostics.some((diagnostic) => diagnostic.code === 2307) &&
          markers.some((marker) => String(marker.code) === '2307')
        );
      } catch {
        // Monaco cancels requests while the project's extra libraries update.
        return false;
      }
    });
    await page.getByRole('button', { name: 'Reset example', exact: true }).click();
    await page.getByRole('button', { name: /schema synced/ }).waitFor();
    assert.equal(
      await page.getByRole('button', { name: 'models/giraffe.ts', exact: true }).count(),
      0,
    );
    console.log('PASS project replacement: removed active file loses worker and editor types');
  } finally {
    await page.close();
  }
}
