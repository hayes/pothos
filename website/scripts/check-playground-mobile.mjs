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
      assert.ok(closeBounds && closeBounds.x >= 0 && closeBounds.x + closeBounds.width <= width);
      for (const control of await frame
        .locator('button:visible, a:visible, select:visible')
        .all()) {
        const box = await control.boundingBox();
        if (!box) {
          continue;
        }
        assert.ok(
          box.x + box.width <= closeBounds.x ||
            box.x >= closeBounds.x + closeBounds.width ||
            box.y + box.height <= closeBounds.y ||
            box.y >= closeBounds.y + closeBounds.height,
          `Close must not cover ${(await control.getAttribute('aria-label')) ?? (await control.textContent())}`,
        );
      }
      if (width >= 768) {
        assert.ok(await frame.getByRole('button', { name: 'Files', exact: true }).isVisible());
      }
      await close.click();
      await page.getByRole('dialog', { name: 'Pothos Playground' }).waitFor({ state: 'detached' });
      console.log(`PASS ${width}px embedded Run, result, and Close`);
    } finally {
      await page.close();
    }
  }
}

export async function checkPlaygroundMobileFiles(browser, origin) {
  for (const width of [320, 390]) {
    const page = await browser.newPage({ viewport: { width, height: 844 } });
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`${origin}/playground?example=playground-tour&step=2`);
      await page.getByRole('button', { name: /schema synced/ }).waitFor();
      const selector = page.getByRole('combobox', { name: 'Source file', exact: true });
      const bounds = await selector.boundingBox();
      assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= width);
      await selector.selectOption({ label: 'models/giraffe.ts' });
      await page.waitForFunction(() =>
        window.monaco?.editor
          .getEditors()
          .some(
            (editor) =>
              editor.getModel()?.uri.toString() === 'file:///playground/models/giraffe.ts',
          ),
      );
      await page.evaluate(() => {
        const model = window.monaco.editor.getModel(
          window.monaco.Uri.parse('file:///playground/models/giraffe.ts'),
        );
        model.setValue(model.getValue().replace('James', 'Mobile giraffe'));
      });
      // Let the 500ms source debounce start a new compilation before waiting for sync.
      await page.waitForTimeout(1000);
      await page.getByRole('button', { name: /schema synced/ }).waitFor();
      await page.getByRole('button', { name: /^Run query/ }).click();
      await page
        .getByLabel('GraphQL result')
        .first()
        .filter({ hasText: 'Mobile giraffe' })
        .waitFor({ state: 'attached' });
      await selector.selectOption('sdl');
      await page.waitForFunction(() =>
        window.monaco.editor
          .getEditors()
          .some(
            (editor) =>
              editor.getModel()?.getLanguageId() === 'graphql' &&
              editor.getOption(window.monaco.editor.EditorOption.readOnly) &&
              editor.getModel()?.getValue().includes('type Giraffe'),
          ),
      );
      await selector.selectOption({ label: 'schema.ts' });
      await page.waitForFunction(() =>
        window.monaco.editor
          .getEditors()
          .some((editor) => editor.getModel()?.uri.toString() === 'file:///playground/schema.ts'),
      );
      const previous = page.getByRole('button', { name: '← Prev', exact: true });
      const next = page.getByRole('button', { name: 'Next →', exact: true });
      for (const button of [previous, next, page.getByRole('button', { name: 'Exit example' })]) {
        const box = await button.boundingBox();
        assert.ok(
          box && box.x >= 0 && box.x + box.width <= width,
          `${width}px: step navigation must fit inside the viewport`,
        );
      }
      await previous.click();
      await page.waitForFunction(
        () => document.querySelector('select[aria-label="Source file"]')?.options.length === 2,
      );
      await next.click();
      await selector
        .locator('option')
        .filter({ hasText: 'models/giraffe.ts' })
        .waitFor({ state: 'attached' });
      console.log(`PASS ${width}px mobile files, edited result, SDL, and previous/next steps`);
    } finally {
      await page.close();
    }
  }
}
