import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    page.setDefaultTimeout(60000);
    await page.goto(process.argv[2] ?? 'http://localhost:3000');
    const embedded = page.frameLocator('iframe');
    await embedded.getByRole('button', { name: /schema synced/ }).waitFor();
    await embedded.getByRole('button', { name: /Run query/ }).click();
    await embedded.getByText('Hello, Pothos!', { exact: false }).first().waitFor();
    await embedded.getByRole('tab', { name: /schema.graphql/ }).click();
    await page
      .frames()
      .find((frame) => frame.url().includes('/playground'))
      .waitForFunction(() =>
        window.monaco.editor
          .getEditors()
          .some(
            (editor) =>
              editor.getModel()?.getLanguageId() === 'graphql' &&
              editor.getValue().includes('type Query'),
          ),
      );
    await embedded.getByRole('tab', { name: 'schema.ts', exact: true }).click();
    if (await embedded.getByRole('button', { name: 'Files', exact: true }).count()) {
      throw Error('Embedded playground sidebar should be hidden');
    }
    await page
      .locator('iframe')
      .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100));
    const frame = page.frames().find((embedded) => embedded.url().includes('/playground'));
    await embedded
      .locator('.monaco-editor .view-line')
      .filter({ hasText: 'const builder' })
      .locator('span')
      .filter({ hasText: /^builder$/ })
      .last()
      .hover();
    await embedded
      .locator('.monaco-hover')
      .filter({ hasText: 'SchemaBuilder' })
      .first()
      .waitFor({ timeout: 15000 });
    console.log('Type hover works');
    await frame.evaluate(() => {
      const editor = window.monaco.editor
        .getEditors()
        .find((editor) => editor.getModel()?.uri.path.endsWith('/schema.ts'));
      editor
        .getModel()
        .setValue(`${editor.getValue()}\n${Array(100).fill('// scroll check').join('\n')}`);
      editor.setScrollTop(0);
    });
    await page.waitForTimeout(500);
    const rect = await embedded.locator('.monaco-editor').first().boundingBox();
    await page.mouse.move(rect.x + 150, rect.y + 100);
    const before = await page.evaluate(() => window.scrollY);
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(400);
    const internal = await frame.evaluate(() =>
      window.monaco.editor
        .getEditors()
        .find((editor) => editor.getModel()?.uri.path.endsWith('/schema.ts'))
        .getScrollTop(),
    );
    if (internal || (await page.evaluate(() => window.scrollY)) <= before) {
      throw Error('Unfocused editor trapped page scrolling');
    }
    console.log('Unfocused editor allows page scrolling');
    await page
      .locator('iframe')
      .evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 100));
    await frame.evaluate(() =>
      window.monaco.editor
        .getEditors()
        .find((editor) => editor.getModel()?.uri.path.endsWith('/schema.ts'))
        .focus(),
    );
    await page.mouse.move(rect.x + 150, rect.y + 100);
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => window.scrollY)) !== before) {
      throw Error('Focused editor did not retain scrolling');
    }
    console.log('Focused editor retains scrolling');
    await frame.evaluate(() => {
      const editor = window.monaco.editor
        .getEditors()
        .find((editor) => editor.getModel()?.uri.path.endsWith('/schema.ts'));
      editor.setScrollTop(editor.getScrollHeight());
    });
    await page.mouse.wheel(0, 250);
    await page.waitForTimeout(400);
    if ((await page.evaluate(() => window.scrollY)) <= before) {
      throw Error('Scroll boundary trapped');
    }
    console.log('Page scrolls at editor boundary');
  } finally {
    await browser.close();
  }
})().catch((editor) => {
  console.error(editor);
  process.exit(1);
});
