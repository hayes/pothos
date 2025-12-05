import { expect, test } from '@playwright/test';

test('debug playground loading', async ({ page }) => {
  // Capture console logs and errors
  const logs: string[] = [];
  const errors: string[] = [];

  page.on('console', (msg) => {
    const text = `[${msg.type()}] ${msg.text()}`;
    logs.push(text);
    console.log(text);
  });

  page.on('pageerror', (error) => {
    const text = `[PAGE ERROR] ${error.message}`;
    errors.push(text);
    console.error(text);
  });

  page.on('requestfailed', (request) => {
    const text = `[REQUEST FAILED] ${request.url()} - ${request.failure()?.errorText}`;
    errors.push(text);
    console.error(text);
  });

  console.log('\n=== Navigating to playground ===');
  await page.goto('/playground');

  console.log('\n=== Waiting 10 seconds for page to load ===');
  await page.waitForTimeout(10000);

  console.log('\n=== Taking screenshot ===');
  await page.screenshot({ path: 'test-results/debug-screenshot.png', fullPage: true });

  console.log('\n=== Page Title ===');
  console.log(await page.title());

  console.log('\n=== Page Content ===');
  const bodyText = await page.locator('body').textContent();
  console.log(bodyText?.substring(0, 500));

  console.log('\n=== All Console Logs ===');
  logs.forEach(log => console.log(log));

  console.log('\n=== All Errors ===');
  errors.forEach(error => console.log(error));

  // Check if Monaco editor loaded
  const hasMonaco = await page.locator('.monaco-editor').count();
  console.log(`\n=== Monaco editors found: ${hasMonaco} ===`);

  // Check for error messages
  const errorText = await page.locator('body').textContent();
  console.log('\n=== Page shows error ===');
  console.log(errorText?.includes('Failed to compile schema'));
});
