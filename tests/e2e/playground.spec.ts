import { expect, test } from '@playwright/test';

test.describe('Playground', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/playground');
  });

  test('should load playground page', async ({ page }) => {
    // Wait for Monaco editor to load (page might not have title immediately)
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Check that we're on the playground page
    const url = page.url();
    expect(url).toContain('/playground');
  });

  test('should load default schema code', async ({ page }) => {
    // Wait for Monaco editor to be ready
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait a moment for content to render
    await page.waitForTimeout(1000);

    // Check that the default code contains expected content
    const editorContent = await page.locator('.monaco-editor .view-lines').first().textContent();
    expect(editorContent).toContain('SchemaBuilder');
    expect(editorContent).toContain('queryType');
  });

  test('should compile schema without errors', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Wait for initial compilation (look for success indicator)
    await page.waitForSelector('text=✓', { timeout: 15000 });

    // Check that no error is shown
    const errorElements = await page.locator('text=Error').count();
    expect(errorElements).toBe(0);
  });

  test('should load bundled Pothos types', async ({ page }) => {
    // Capture console logs
    const logs: string[] = [];
    page.on('console', (msg) => {
      logs.push(msg.text());
    });

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for types to load
    await page.waitForTimeout(2000);

    // Check console logs for type loading
    const hasTypesLog = logs.some(log =>
      log.includes('Loaded') && log.includes('Pothos type definitions')
    );

    console.log('Console logs:', logs);
    expect(hasTypesLog).toBeTruthy();
  });

  test('should handle schema errors gracefully', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for initial compilation to complete
    await page.waitForTimeout(2000);

    // Focus the editor by clicking on it
    await page.locator('.monaco-editor').first().click();
    await page.waitForTimeout(500);

    // Select all and delete
    await page.keyboard.press('Meta+A'); // Use Meta (Cmd) for Mac
    await page.keyboard.press('Backspace');

    // Type invalid code
    await page.keyboard.type('invalid code here');

    // Wait for compilation to fail
    await page.waitForTimeout(3000);

    // Check that an error is shown
    const hasError = await page.locator('text=/Error|error|failed/i').count();
    expect(hasError).toBeGreaterThan(0);
  });

  test('should switch between Code and GraphQL views', async ({ page }) => {
    // Wait for the page to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });

    // Click the GraphQL view button (the GraphQL icon in the sidebar)
    const graphqlButton = page.locator('button[title="GraphQL Query"]');
    await graphqlButton.click();

    // Wait for GraphQL editor to appear
    await page.waitForTimeout(1000);

    // Switch back to code view
    const codeButton = page.locator('button[title="Source Code (TypeScript)"]');
    await codeButton.click();

    // Verify we're back to code view
    await page.waitForSelector('.monaco-editor', { timeout: 5000 });
  });

  test('should have Monaco editor with TypeScript syntax highlighting', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for compilation to complete
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Verify editor has syntax highlighting by checking for syntax tokens
    const hasSyntaxTokens = await page.locator('.monaco-editor .mtk1, .monaco-editor .mtk5, .monaco-editor .mtk6').count();
    expect(hasSyntaxTokens).toBeGreaterThan(0);
  });

  test('should show schema SDL in right panel', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for compilation
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Wait a bit for schema to render
    await page.waitForTimeout(1000);

    // Check that the schema panel shows GraphQL SDL
    const schemaPanel = page.locator('.schema-viewer');
    await expect(schemaPanel).toBeVisible({ timeout: 10000 });

    // Check for GraphQL type definitions
    const schemaContent = await schemaPanel.textContent();
    expect(schemaContent).toMatch(/type\s+Query/); // Use regex to handle whitespace variations
  });
});
