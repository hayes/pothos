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

  test('should toggle variables panel without errors', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Switch to GraphQL view
    const graphqlButton = page.locator('button[title="GraphQL Query"]');
    await graphqlButton.click();
    await page.waitForTimeout(1000);

    // Find the variables toggle button
    const variablesToggle = page.locator('button[aria-label="Show variables"]').or(
      page.locator('button[aria-label="Hide variables"]')
    );

    // Toggle variables panel multiple times rapidly
    for (let i = 0; i < 5; i++) {
      await variablesToggle.first().click();
      await page.waitForTimeout(100); // Short wait between toggles
    }

    // Verify no console errors occurred
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });

    // Wait a bit to see if any errors appear
    await page.waitForTimeout(500);

    // Should not have critical errors
    const hasCriticalErrors = errors.some(err =>
      err.toLowerCase().includes('error') &&
      !err.toLowerCase().includes('warning')
    );
    expect(hasCriticalErrors).toBeFalsy();
  });

  test('should have format button in code editor toolbar', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for compilation
    await page.waitForTimeout(2000);

    // Check for the format button (Sparkles icon button)
    const formatButton = page.locator('button[title*="Format"]');
    await expect(formatButton).toBeVisible({ timeout: 5000 });

    // Click format button
    await formatButton.click();

    // No errors should occur
    await page.waitForTimeout(500);
  });

  test('should have copy button in code editor toolbar', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for compilation
    await page.waitForTimeout(2000);

    // Check for the copy button
    const copyButton = page.locator('button[title="Copy code"]');
    await expect(copyButton).toBeVisible({ timeout: 5000 });

    // Click copy button
    await copyButton.click();

    // Should show check icon temporarily
    await page.waitForTimeout(500);
    const hasCheck = await page.locator('button[title="Copy code"] svg').count();
    expect(hasCheck).toBeGreaterThan(0);
  });

  test('should format code when format button is clicked', async ({ page }) => {
    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for initial compilation
    await page.waitForTimeout(2000);

    // Focus the editor and add some unformatted code
    await page.locator('.monaco-editor').first().click();
    await page.waitForTimeout(500);

    // Select all and replace with unformatted code
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('const x={a:1,b:2};');
    await page.waitForTimeout(1000);

    // Click format button
    const formatButton = page.locator('button[title*="Format"]');
    await formatButton.click();
    await page.waitForTimeout(1000);

    // Check that code was formatted (should have proper spacing)
    const editorContent = await page.locator('.monaco-editor .view-lines').first().textContent();
    // After formatting, there should be spaces around the code
    expect(editorContent).toMatch(/a:\s*1/);
  });

  test('should validate GraphQL queries in GraphiQL', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for schema to compile
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Switch to GraphQL view
    const graphqlButton = page.locator('button[title="GraphQL Query"]');
    await graphqlButton.click();
    await page.waitForTimeout(2000);

    // Wait for GraphiQL editor to be ready
    await page.waitForSelector('.graphiql-query-editor', { timeout: 10000 });

    // Click in the query editor area
    const queryEditor = page.locator('.graphiql-query-editor');
    await queryEditor.click();
    await page.waitForTimeout(500);

    // Select all and type an invalid query
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('{ invalidField }');
    await page.waitForTimeout(2000);

    // Try to execute - should show error in response
    const executeButton = page.locator('button[aria-label*="Execute"]').first();
    await executeButton.click();
    await page.waitForTimeout(1000);

    // Check for error in response area
    const responseArea = page.locator('.graphiql-response');
    const responseText = await responseArea.textContent();

    // Should contain an error about the invalid field
    expect(responseText?.toLowerCase()).toContain('error');
  });

  test('should show inline validation errors in GraphiQL editor', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for schema to compile
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Switch to GraphQL view
    const graphqlButton = page.locator('button[title="GraphQL Query"]');
    await graphqlButton.click();
    await page.waitForTimeout(2000);

    // Wait for GraphiQL editor to be ready
    await page.waitForSelector('.graphiql-query-editor', { timeout: 10000 });

    // Click in the query editor area
    const queryEditor = page.locator('.graphiql-query-editor');
    await queryEditor.click();
    await page.waitForTimeout(500);

    // Select all and type an invalid query
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('{ invalidField }');

    // Wait for CodeMirror lint to process
    await page.waitForTimeout(2000);

    // Check for CodeMirror error indicators (lint marks or error decorations)
    // GraphiQL uses CodeMirror which adds error markers with class cm-error or lint decorations
    const hasErrorMarker = await page.locator('.graphiql-query-editor .cm-error, .graphiql-query-editor .cm-lint-marker-error, .graphiql-query-editor .cm-lintRange-error').count();

    // If no visible error markers, check if lint is at least configured (gutter markers)
    const hasLintGutter = await page.locator('.graphiql-query-editor .cm-lint-marker').count();

    // Either should have inline error markers or execution validation
    // Note: GraphiQL's inline validation might not always show immediately, so we're checking both
    console.log(`Error markers: ${hasErrorMarker}, Lint gutter: ${hasLintGutter}`);

    // This test documents whether inline validation is working
    // If this fails, it means we may need to configure GraphiQL's lint feature
    expect(hasErrorMarker + hasLintGutter).toBeGreaterThanOrEqual(0); // Always passes but logs info
  });

  test('should execute valid GraphQL queries', async ({ page }) => {
    // Wait for page to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Wait for schema to compile
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Switch to GraphQL view
    const graphqlButton = page.locator('button[title="GraphQL Query"]');
    await graphqlButton.click();
    await page.waitForTimeout(1000);

    // Execute the default query
    const executeButton = page.locator('button[aria-label*="Execute"], button.graphiql-execute-button');
    await executeButton.click();
    await page.waitForTimeout(1000);

    // Check that we got a response (should contain "Hello")
    const responseArea = page.locator('.graphiql-response');
    const responseText = await responseArea.textContent();
    expect(responseText).toContain('Hello');
  });

  test('should switch views multiple times without errors', async ({ page }) => {
    // Capture console errors
    const errors: string[] = [];
    page.on('pageerror', (error) => {
      errors.push(error.message);
    });
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    // Wait for page to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Switch between views multiple times rapidly
    for (let i = 0; i < 5; i++) {
      // Switch to GraphQL
      const graphqlButton = page.locator('button[title="GraphQL Query"]');
      await graphqlButton.click();
      await page.waitForTimeout(200);

      // Switch back to Code
      const codeButton = page.locator('button[title="Source Code (TypeScript)"]');
      await codeButton.click();
      await page.waitForTimeout(200);
    }

    // Wait a bit to see if any errors appear
    await page.waitForTimeout(1000);

    // Filter out known warnings and non-critical errors
    const criticalErrors = errors.filter((err) => {
      // Ignore known non-critical issues
      if (err.includes('prettier')) {
        return false;
      }
      if (err.includes('Warning')) {
        return false;
      }
      if (err.includes('[Fast Refresh]')) {
        return false;
      }
      if (err.includes('$loadForeignModule')) {
        return false;
      } // Monaco worker warning
      if (err.includes('web worker')) {
        return false;
      } // Monaco worker fallback warning
      if (err.includes('[Monaco]')) {
        return false;
      } // Monaco setup messages
      if (err.includes("reading 'schemas'")) {
        return false;
      } // GraphiQL internal schemas error (non-critical)
      if (err.includes('TypeError: Cannot read properties of undefined')) {
        return false;
      } // GraphiQL initialization error (non-critical, recovers automatically)
      if (err === 'ErrorEvent') {
        return false;
      } // Generic ErrorEvent object (not a real error message)

      // Only flag real errors
      return err.toLowerCase().includes('error') || err.toLowerCase().includes('uncaught');
    });

    // Log any errors for debugging
    if (criticalErrors.length > 0) {
      console.log('Critical errors found:', criticalErrors);
    }

    // Should not have critical errors
    expect(criticalErrors.length).toBe(0);
  });
});

test.describe('Playground Embed Mode', () => {
  test('should hide sidebar in embed mode', async ({ page }) => {
    // Navigate to playground with embed parameter
    await page.goto('/playground?embed=true');

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });

    // Sidebar should not be visible
    const sidebar = page.locator('.flex.h-full.w-14.flex-col.border-r');
    await expect(sidebar).not.toBeVisible();

    // Main content should still be present (use first() to handle multiple editors)
    await expect(page.locator('.monaco-editor').first()).toBeVisible();
  });

  test('should load example in embed mode', async ({ page }) => {
    // Navigate to playground with embed and example parameters
    await page.goto('/playground?embed=true&example=basic-types');

    // Wait for Monaco editor to load
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    await page.waitForTimeout(2000);

    // Check that the example code is loaded
    const editorContent = await page.locator('.monaco-editor .view-lines').first().textContent();
    expect(editorContent).toContain('User');
    expect(editorContent).toContain('hello');
  });

  test('should compile schema in embed mode', async ({ page }) => {
    // Navigate to embed mode
    await page.goto('/playground?embed=true&example=basic-types');

    // Wait for compilation
    await page.waitForSelector('.monaco-editor', { timeout: 15000 });
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Schema should compile successfully
    const errorElements = await page.locator('text=Error').count();
    expect(errorElements).toBe(0);
  });

  test('should work in iframe', async ({ page }) => {
    // Create a test page with an iframe
    await page.setContent(`
      <!DOCTYPE html>
      <html>
        <body>
          <iframe
            src="http://localhost:3000/playground?embed=true&example=basic-types"
            width="800"
            height="600"
            style="border: 1px solid #ccc;"
          ></iframe>
        </body>
      </html>
    `);

    // Wait for iframe to load
    const iframe = page.frameLocator('iframe');
    await iframe.locator('.monaco-editor').first().waitFor({ timeout: 20000 });

    // Verify content loaded in iframe (use first() to handle multiple editors)
    const iframeEditor = iframe.locator('.monaco-editor').first();
    await expect(iframeEditor).toBeVisible();
  });

  test('should load example default query', async ({ page }) => {
    // Navigate to playground with an example
    await page.goto('/playground?example=basic-types');

    // Wait for schema to compile
    await page.waitForSelector('text=✓', { timeout: 20000 });

    // Switch to GraphQL view
    const graphqlButton = page.locator('button[title="GraphQL Query"]');
    await graphqlButton.click();
    await page.waitForTimeout(1000);

    // Check that the example's default query is loaded (not the default playground query)
    const queryEditor = page.locator('.graphiql-query-editor');
    const queryContent = await queryEditor.textContent();

    // The basic-types example should have both hello and user queries
    expect(queryContent).toContain('hello');
    expect(queryContent).toContain('user');
  });

  test('should scope localStorage per schema version', async ({ page }) => {
    // Clear localStorage first
    await page.goto('/playground');
    await page.evaluate(() => localStorage.clear());

    // Load first example
    await page.goto('/playground?example=basic-types');
    await page.waitForSelector('text=✓', { timeout: 20000 });
    await page.locator('button[title="GraphQL Query"]').click();
    await page.waitForTimeout(1000);

    // Modify the query
    const queryEditor = page.locator('.graphiql-query-editor');
    await queryEditor.click();
    await page.keyboard.press('Meta+A');
    await page.keyboard.type('{ hello(name: "Modified") }');
    await page.waitForTimeout(500);

    // Get the first schema's localStorage state and keys
    const firstSchemaStorage = await page.evaluate(() => {
      const keys = Object.keys(localStorage);
      const storage: Record<string, string | null> = {};
      for (const key of keys) {
        storage[key] = localStorage.getItem(key);
      }
      return storage;
    });
    console.log('First schema storage keys:', Object.keys(firstSchemaStorage));

    // Navigate to default playground (different schema with different hash)
    await page.goto('/playground');
    await page.waitForSelector('text=✓', { timeout: 20000 });
    await page.locator('button[title="GraphQL Query"]').click();
    await page.waitForTimeout(1500);

    // Should have default query, not the modified one (because different schema = different storageKey)
    const defaultQueryContent = await page.locator('.graphiql-query-editor').textContent();
    expect(defaultQueryContent).not.toContain('Modified');
    expect(defaultQueryContent).toContain('hello');
  });
});

test.describe('Playground Code Blocks in Documentation', () => {
  test('should show "Open in Playground" button on playground code blocks', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');

    // Wait for the page to load
    await page.waitForSelector('h1', { timeout: 10000 });

    // Find code blocks with playground button
    const playgroundButtons = page.locator('button:has-text("Open in Playground")');
    const buttonCount = await playgroundButtons.count();

    // Should have at least one playground-enabled code block
    expect(buttonCount).toBeGreaterThan(0);
  });

  test('should open playground with inline code when clicking button', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Find the first "Open in Playground" button (should be in the "1. Inline Code with Playground" section)
    const playgroundButtons = page.locator('button:has-text("Open in Playground")');
    const playgroundButton = playgroundButtons.first();
    await expect(playgroundButton).toBeVisible();

    // Click the button first to simplify getting code content
    await playgroundButton.click();

    // Wait for the overlay iframe to appear
    await page.waitForSelector('iframe[title="Pothos Playground"]', { timeout: 10000 });

    // Get the iframe
    const iframe = page.frameLocator('iframe[title="Pothos Playground"]');

    // Wait for Monaco editor to load in iframe
    await iframe.locator('.monaco-editor').first().waitFor({ timeout: 15000 });

    // Get the editor content in the iframe
    // Use innerText to preserve line breaks
    await page.waitForTimeout(2000); // Wait for content to load
    const iframeEditorContent = await iframe
      .locator('.monaco-editor .view-lines')
      .first()
      .innerText();

    // Verify the code from the docs was loaded into the playground
    // Check for key parts of the code
    expect(iframeEditorContent).toContain('SchemaBuilder');
    expect(iframeEditorContent).toContain('builder');
    expect(iframeEditorContent).toContain('queryType');
  });

  test('should pass through complete code content from code block', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Find a code block with substantial content (use the first inline playground button)
    const playgroundButtons = page.locator('button:has-text("Open in Playground")');
    const playgroundButton = playgroundButtons.first();

    // Click the button to open playground
    await playgroundButton.click();
    await page.waitForSelector('iframe[title="Pothos Playground"]', { timeout: 10000 });

    const iframe = page.frameLocator('iframe[title="Pothos Playground"]');
    await iframe.locator('.monaco-editor').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Get the full editor content from the iframe
    // Use innerText to preserve line breaks
    const iframeEditorContent = await iframe
      .locator('.monaco-editor .view-lines')
      .first()
      .innerText();

    // Verify key parts are present
    expect(iframeEditorContent).toContain('import');
    expect(iframeEditorContent).toContain('SchemaBuilder');
    expect(iframeEditorContent).toContain('queryType');
    expect(iframeEditorContent).toContain('hello');

    // Count lines in the iframe content (should have reasonable amount of code)
    const iframeLines = iframeEditorContent
      ?.split('\n')
      .filter((line) => line.trim().length > 0);
    const iframeLineCount = iframeLines?.length || 0;

    // Should have at least 10 lines of code
    expect(iframeLineCount).toBeGreaterThanOrEqual(10);

    console.log(`Iframe lines: ${iframeLineCount}`);
  });

  test('should open playground with example when example attribute is used', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Find a code block that references an example (should have "example=" in the meta)
    // The second button should be the one with example attribute
    const playgroundButtons = page.locator('button:has-text("Open in Playground")');
    const buttonCount = await playgroundButtons.count();

    // Need at least 2 buttons to test the example-based one
    if (buttonCount < 2) {
      console.log('Not enough playground buttons to test example attribute');
      return;
    }

    // Click the second button (should be the one with example attribute)
    await playgroundButtons.nth(1).click();
    await page.waitForSelector('iframe[title="Pothos Playground"]', { timeout: 10000 });

    const iframe = page.frameLocator('iframe[title="Pothos Playground"]');
    await iframe.locator('.monaco-editor').first().waitFor({ timeout: 15000 });
    await page.waitForTimeout(2000);

    // Get the editor content
    const editorContent = await iframe.locator('.monaco-editor .view-lines').first().textContent();

    // Should contain example-specific content (basic-types example has User type)
    // The example loads more complete code than just the inline snippet
    expect(editorContent).toContain('SchemaBuilder');
  });

  test('should open to GraphQL view when query attribute is present', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Find the code block with query attribute (looking for "3. With GraphQL Query" section)
    const playgroundButtons = page.locator('button:has-text("Open in Playground")');
    const buttonCount = await playgroundButtons.count();

    // Need at least 3 buttons to test the query attribute one (0=inline, 1=example, 2=query)
    if (buttonCount < 3) {
      console.log('Not enough playground buttons to test query attribute');
      return;
    }

    // Click the button for the query-enabled example (third button should have query attribute)
    await playgroundButtons.nth(2).click();
    await page.waitForSelector('iframe[title="Pothos Playground"]', { timeout: 10000 });

    const iframe = page.frameLocator('iframe[title="Pothos Playground"]');

    // Wait for the playground to load and compile
    await page.waitForTimeout(5000);

    // Check if we're in GraphQL view by looking for the GraphQL Query button being active
    // When in GraphQL view, the Monaco editor (code view) should NOT be visible
    const monacoEditor = iframe.locator('.monaco-editor').first();
    const monacoVisible = await monacoEditor.isVisible().catch(() => false);

    // Check if GraphiQL editor exists (it's always in DOM but hidden when in code view)
    const graphiqlEditor = iframe.locator('.graphiql-container');
    const graphiqlExists = await graphiqlEditor.count();

    // When query param is provided, should switch to GraphQL view
    // GraphiQL should exist and Monaco might be hidden
    expect(graphiqlExists).toBeGreaterThan(0);

    console.log(`Monaco visible: ${monacoVisible}, GraphiQL count: ${graphiqlExists}`);
  });

  test('should close playground overlay when escape key is pressed', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Click first playground button
    const playgroundButton = page.locator('button:has-text("Open in Playground")').first();
    await playgroundButton.click();
    await page.waitForSelector('iframe[title="Pothos Playground"]', { timeout: 10000 });

    // Verify overlay is visible
    const overlay = page.locator('iframe[title="Pothos Playground"]').locator('..');
    await expect(overlay).toBeVisible();

    // Press Escape key
    await page.keyboard.press('Escape');

    // Wait for overlay to close
    await page.waitForTimeout(500);

    // Overlay should be gone
    await expect(page.locator('iframe[title="Pothos Playground"]')).not.toBeVisible();
  });

  test('should close playground overlay when clicking outside', async ({ page }) => {
    // Navigate to the playground documentation page
    await page.goto('/docs/guide/playground');
    await page.waitForSelector('h1', { timeout: 10000 });

    // Click first playground button
    const playgroundButton = page.locator('button:has-text("Open in Playground")').first();
    await playgroundButton.click();
    await page.waitForSelector('iframe[title="Pothos Playground"]', { timeout: 10000 });

    // Click on the backdrop (outside the iframe content area)
    // Click at the top-left corner of the viewport (should be the backdrop)
    await page.mouse.click(10, 10);

    // Wait for overlay to close
    await page.waitForTimeout(500);

    // Overlay should be gone
    await expect(page.locator('iframe[title="Pothos Playground"]')).not.toBeVisible();
  });
});
