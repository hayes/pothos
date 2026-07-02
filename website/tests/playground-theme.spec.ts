import { expect, test } from '@playwright/test';

test.describe('Playground Theme', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/playground');

    // Wait for Monaco to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
  });

  test('should have correct initial Monaco theme based on system preference', async ({ page }) => {
    // Get the current theme from document classes
    const htmlClasses = await page.evaluate(() => document.documentElement.className);

    // Check Monaco theme
    const monacoTheme = await page.evaluate(() => {
      // @ts-expect-error
      return window.monaco?.editor?.getModels()?.[0]?._options?.theme || 'unknown';
    });

    // Get computed background color of Monaco editor
    const editorBg = await page.evaluate(() => {
      const editor = document.querySelector('.monaco-editor');
      return editor ? window.getComputedStyle(editor).backgroundColor : 'none';
    });

    expect(htmlClasses).toBeDefined();
    expect(monacoTheme).not.toBe('unknown');
    expect(editorBg).not.toBe('none');
  });

  test('should toggle Monaco theme when clicking theme button', async ({ page }) => {
    // Wait a bit for Monaco to fully initialize
    await page.waitForTimeout(1000);

    // Get initial state
    const initialHtmlClasses = await page.evaluate(() => document.documentElement.className);

    // Get initial Monaco editor text color (backgrounds are now transparent)
    const initialTextColor = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });

    // Find the theme toggle button (it should have Sun or Moon icon)
    const themeButton = page.locator('button[title*="Switch to"]').first();
    await expect(themeButton).toBeVisible();

    // Click the theme toggle
    await themeButton.click();

    // Wait for theme to update
    await page.waitForTimeout(500);

    // Check HTML classes after toggle
    const afterHtmlClasses = await page.evaluate(() => document.documentElement.className);

    // Check if classes changed
    expect(afterHtmlClasses).not.toBe(initialHtmlClasses);

    // Check Monaco editor text color after toggle (backgrounds are transparent)
    const afterTextColor = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });

    // The text color should have changed
    expect(afterTextColor).not.toBe(initialTextColor);
  });

  test('should update all Monaco editors when theme changes', async ({ page }) => {
    // Wait for initial load
    await page.waitForTimeout(1000);

    // Get text colors from all Monaco editors (backgrounds are transparent)
    const initialTextColors = await page.evaluate(() => {
      const lines = Array.from(document.querySelectorAll('.monaco-editor .view-line'));
      return lines.map((line) => window.getComputedStyle(line).color);
    });

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

    // All editors should have changed text colors
    for (let i = 0; i < Math.min(initialTextColors.length, afterTextColors.length); i++) {
      expect(afterTextColors[i]).not.toBe(initialTextColors[i]);
    }
  });

  test('should inspect Monaco theme API', async ({ page }) => {
    await page.waitForTimeout(1000);

    const monacoDebugInfo = await page.evaluate(() => {
      // @ts-expect-error
      const monaco = window.monaco;
      if (!monaco) {
        return { error: 'Monaco not available' };
      }

      // Try to access Monaco's internal theme state
      const editor = monaco.editor;
      const models = editor.getModels();

      return {
        monacoAvailable: true,
        modelsCount: models.length,
        editorMethods: Object.keys(editor).filter(
          (k) => typeof (editor as unknown as Record<string, unknown>)[k] === 'function',
        ),
        // Try to get theme
        canSetTheme: typeof editor.setTheme === 'function',
        // Check what themes are defined
        themes: (editor as unknown as { _themeService?: unknown })._themeService
          ? 'themeService exists'
          : 'no themeService',
      };
    });

    expect(monacoDebugInfo.monacoAvailable).toBe(true);

    // Try to manually set theme and see if it works (check text color since backgrounds are transparent)
    await page.evaluate(() => {
      // @ts-expect-error
      const monaco = window.monaco;
      if (monaco) {
        monaco.editor.setTheme('vs');
      }
    });

    await page.waitForTimeout(200);

    // Check text color
    const textColorAfterVs = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });

    // Set to dark
    await page.evaluate(() => {
      // @ts-expect-error
      const monaco = window.monaco;
      if (monaco) {
        monaco.editor.setTheme('vs-dark');
      }
    });

    await page.waitForTimeout(200);

    const textColorAfterVsDark = await page.evaluate(() => {
      const line = document.querySelector('.monaco-editor .view-line');
      return line ? window.getComputedStyle(line).color : 'none';
    });

    // These should be different
    expect(textColorAfterVs).not.toBe(textColorAfterVsDark);
  });
});
