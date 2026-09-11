import assert from 'node:assert/strict';

export async function checkPlaygroundMobile(browser, origin) {
  for (const width of [320, 390, 1024]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`${origin}/docs/guide/objects`);
      await page.getByRole('button', { name: 'Open in Playground', exact: true }).first().click();
      const frame = page.frameLocator('iframe[title="Pothos Playground"]');
      await frame.getByRole('button', { name: /schema synced/ }).waitFor();
      const run = frame.getByRole('button', { name: /^Run query/ });
      const bounds = await run.boundingBox();
      assert.ok(
        bounds && bounds.x >= 0 && bounds.x + bounds.width <= width,
        `${width}px: Run must fit inside the viewport`,
      );
      await run.click();
      await frame
        .getByLabel('GraphQL result')
        .first()
        .filter({ hasText: 'James' })
        .waitFor({ state: 'attached' });
      const close = page.getByRole('button', { name: 'Close playground', exact: true });
      const closeBounds = await close.boundingBox();
      const frameBounds = await page.locator('iframe[title="Pothos Playground"]').boundingBox();
      assert.ok(
        closeBounds && frameBounds && closeBounds.y + closeBounds.height <= frameBounds.y,
        'Close must not cover playground content',
      );
      await close.click();
      await page.getByRole('dialog', { name: 'Pothos Playground' }).waitFor({ state: 'detached' });
      console.log(`PASS ${width}px embedded Run, result, and Close`);
    } finally {
      await page.close();
    }
  }
}
