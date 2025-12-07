import { test, expect } from '@playwright/test';

test.describe('Playground Theme', () => {
  test.beforeEach(async ({ page }) => {
    // Enable console logging
    page.on('console', (msg) => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    await page.goto('http://localhost:3000/playground');

    // Wait for Monaco to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
  });

  test('should have correct initial Monaco theme based on system preference', async ({ page }) => {
    // Get the current theme from document classes
    const htmlClasses = await page.evaluate(() => document.documentElement.className);
    console.log('Initial HTML classes:', htmlClasses);

    // Check Monaco theme
    const monacoTheme = await page.evaluate(() => {
      // @ts-ignore
      return window.monaco?.editor?.getModels()?.[0]?._options?.theme || 'unknown';
    });
    console.log('Initial Monaco theme:', monacoTheme);

    // Get computed background color of Monaco editor
    const editorBg = await page.evaluate(() => {
      const editor = document.querySelector('.monaco-editor');
      return editor ? window.getComputedStyle(editor).backgroundColor : 'none';
    });
    console.log('Editor background color:', editorBg);
  });

  test('should toggle Monaco theme when clicking theme button', async ({ page }) => {
    // Get initial state
    const initialHtmlClasses = await page.evaluate(() => document.documentElement.className);
    console.log('Initial HTML classes:', initialHtmlClasses);

    // Wait a bit for Monaco to fully initialize
    await page.waitForTimeout(1000);

    // Get initial Monaco editor text color (backgrounds are now transparent)
    const initialTextColor = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });
    console.log('Initial Monaco text color:', initialTextColor);

    // Find the theme toggle button (it should have Sun or Moon icon)
    const themeButton = page.locator('button[title*="Switch to"]').first();
    await expect(themeButton).toBeVisible();

    const buttonTitle = await themeButton.getAttribute('title');
    console.log('Theme button title:', buttonTitle);

    // Click the theme toggle
    await themeButton.click();

    // Wait for theme to update
    await page.waitForTimeout(500);

    // Check HTML classes after toggle
    const afterHtmlClasses = await page.evaluate(() => document.documentElement.className);
    console.log('After toggle HTML classes:', afterHtmlClasses);

    // Check if classes changed
    expect(afterHtmlClasses).not.toBe(initialHtmlClasses);

    // Check Monaco editor text color after toggle (backgrounds are transparent)
    const afterTextColor = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });
    console.log('After toggle Monaco text color:', afterTextColor);

    // The text color should have changed
    expect(afterTextColor).not.toBe(initialTextColor);

    // Take screenshot for visual inspection
    await page.screenshot({ path: '/tmp/playground-theme-after-toggle.png' });
  });

  test('should update all Monaco editors when theme changes', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1000);

    // Get text colors from all Monaco editors (backgrounds are transparent)
    const initialTextColors = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
      return lines.map((line) => window.getComputedStyle(line).color);
    });

    console.log('Initial editor text colors:', initialTextColors);

    // Toggle theme
    const themeButton = page.locator('button[title*="Switch to"]').first();
    await themeButton.click();

    // Wait for theme update
    await page.waitForTimeout(500);

    // Check all Monaco editors updated
    const afterTextColors = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
      return lines.map((line) => window.getComputedStyle(line).color);
    });

    console.log('After toggle editor text colors:', afterTextColors);

    // All editors should have changed text colors
    for (let i = 0; i < Math.min(initialTextColors.length, afterTextColors.length); i++) {
      expect(afterTextColors[i]).not.toBe(initialTextColors[i]);
    }
  });

  test('should inspect Monaco theme API', async ({ page }) => {
    await page.waitForTimeout(1000);

    const monacoDebugInfo = await page.evaluate(() => {
      // @ts-ignore
      const monaco = window.monaco;
      if (!monaco) return { error: 'Monaco not available' };

      // Try to access Monaco's internal theme state
      const editor = monaco.editor;
      const models = editor.getModels();

      return {
        monacoAvailable: true,
        modelsCount: models.length,
        editorMethods: Object.keys(editor).filter(k => typeof (editor as any)[k] === 'function'),
        // Try to get theme
        canSetTheme: typeof editor.setTheme === 'function',
        // Check what themes are defined
        themes: (editor as any)._themeService ? 'themeService exists' : 'no themeService',
      };
    });

    console.log('Monaco debug info:', JSON.stringify(monacoDebugInfo, null, 2));

    // Try to manually set theme and see if it works (check text color since backgrounds are transparent)
    await page.evaluate(() => {
      // @ts-ignore
      const monaco = window.monaco;
      if (monaco) {
        console.log('Attempting to set theme to "vs"');
        monaco.editor.setTheme('vs');
      }
    });

    await page.waitForTimeout(200);

    // Check text color
    const textColorAfterVs = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });
    console.log('Text color after setting vs:', textColorAfterVs);

    // Set to dark
    await page.evaluate(() => {
      // @ts-ignore
      const monaco = window.monaco;
      if (monaco) {
        console.log('Attempting to set theme to "vs-dark"');
        monaco.editor.setTheme('vs-dark');
      }
    });

    await page.waitForTimeout(200);

    const textColorAfterVsDark = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });
    console.log('Text color after setting vs-dark:', textColorAfterVsDark);

    // These should be different
    expect(textColorAfterVs).not.toBe(textColorAfterVsDark);
  });
});
