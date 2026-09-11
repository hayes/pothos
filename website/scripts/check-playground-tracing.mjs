import assert from 'node:assert/strict';

// Durations are intentionally not golden responses. Verify the real console output
// and a reader edit separately from the deterministic lifecycle operation fixtures.
export async function checkPlaygroundTracing(browser, origin) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  page.setDefaultTimeout(60000);
  try {
    for (const [example, label] of [
      ['plugin-tracing', 'Query.hello'],
      ['plugin-tracing-options', 'greeting'],
    ]) {
      await page.goto(`${origin}/playground?example=${example}`);
      await page.getByRole('button', { name: /schema synced/ }).waitFor();
      await page.getByRole('button', { name: /^Run query/ }).click();
      await page
        .getByLabel('GraphQL result')
        .first()
        .filter({ hasText: 'hello, Pothos' })
        .waitFor({ state: 'attached' });
      await page.getByRole('button', { name: /^Console/ }).click();
      const log = page.getByRole('region', { name: 'Console' });
      await log.getByText(new RegExp(`${label.replace('.', '\\.')}: [0-9.]+ms`)).waitFor();
      const duration = (await log.textContent()).match(/: ([0-9.]+)ms/);
      assert.ok(duration && Number.isFinite(Number(duration[1])) && Number(duration[1]) >= 0);
    }
    await page.goto(`${origin}/playground?example=plugin-tracing-lifecycle`);
    await page.getByRole('button', { name: /schema synced/ }).waitFor();
    await page.evaluate(() => {
      const model = window.monaco.editor.getModel(
        window.monaco.Uri.parse('file:///playground/schema.ts'),
      );
      const value = model.getValue();
      const next = value.replace(
        /quiet: t.string\(\{\s*tracing: false/,
        'quiet: t.string({ tracing: true',
      );
      if (next === value) {
        throw new Error('Tracing edit target missing');
      }
      model.setValue(next);
    });
    await page.waitForTimeout(1000);
    await page.getByRole('button', { name: /schema synced/ }).waitFor();
    await page.getByRole('button', { name: /^Run query/ }).click();
    const output = page.getByLabel('GraphQL result').first();
    await output.filter({ hasText: 'start quiet' }).waitFor({ state: 'attached' });
    const result = JSON.parse(await output.textContent());
    assert.deepEqual(result.data.events.slice(-2), ['start quiet', 'end quiet: ok']);
    assert.equal(result.errors.length, 2, 'Tracing must preserve both resolver errors');
    console.log('PASS tracing duration logs, custom label, and edited field opt-in');
  } finally {
    await page.close();
  }
}
