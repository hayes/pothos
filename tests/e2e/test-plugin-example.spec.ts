import { expect, test } from '@playwright/test';

test('plugin example should compile and execute', async ({ page }) => {
  // Capture console messages
  const consoleMessages: string[] = [];
  page.on('console', (msg) => {
    consoleMessages.push(`[${msg.type()}] ${msg.text()}`);
    console.log(`[${msg.type()}]`, msg.text());
  });

  // Navigate to playground
  await page.goto('http://localhost:3000/playground');

  // Wait for Monaco editor to load
  await page.waitForSelector('.monaco-editor', { timeout: 10000 });

  // Wait a bit for initial compilation
  await page.waitForTimeout(2000);

  // Look for the examples dropdown/button
  const examplesButton = page.locator('button:has-text("Examples")');
  if (await examplesButton.isVisible()) {
    await examplesButton.click();
    await page.waitForTimeout(500);

    // Click on Simple Objects Plugin example
    const simpleObjectsOption = page.locator('text=Simple Objects Plugin').first();
    await simpleObjectsOption.click();
    console.log('Clicked on Simple Objects Plugin example');
    await page.waitForTimeout(2000);
  }

  // Wait for compilation to complete
  await page.waitForTimeout(3000);

  // Look for error display at the top of the editor
  const errorBox = page.locator('[class*="error"]').first();
  const errorText = await errorBox.textContent().catch(() => '');
  console.log('Error box text:', errorText || '(empty)');

  // Check for specific compilation error patterns
  const pageContent = await page.content();
  const hasErrorInPage = pageContent.includes('Missing initializer') ||
                         pageContent.includes('Compilation error') ||
                         pageContent.includes('SyntaxError');

  if (hasErrorInPage) {
    console.log('ERROR FOUND IN PAGE CONTENT');
    // Extract the error message
    const allText = await page.locator('body').textContent();
    const errorMatch = allText?.match(/(Missing initializer[^\.]*\.)/);
    if (errorMatch) {
      console.log('Error message:', errorMatch[0]);
    }
  }

  // Take a screenshot for debugging
  await page.screenshot({ path: 'plugin-test-error.png', fullPage: true });

  // Check if there's a visible error message
  expect(hasErrorInPage).toBe(false);
});
