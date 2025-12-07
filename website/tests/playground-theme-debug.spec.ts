import { test, expect } from '@playwright/test';

test.describe('Playground Theme Debug', () => {
  test('debug all Monaco editors and their themes', async ({ page }) => {
    // Enable console logging
    page.on('console', (msg) => {
      console.log(`Browser console [${msg.type()}]:`, msg.text());
    });

    await page.goto('http://localhost:3000/playground');

    // Wait for Monaco to load
    await page.waitForSelector('.monaco-editor', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Get all Monaco editors on the page
    const editorInfo = await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.monaco-editor'));
      return editors.map((editor, index) => {
        const parent = editor.closest('[class*="graphiql"], [class*="schema-viewer"]');
        const parentClass = parent?.className || 'unknown';
        const line = editor.querySelector('.view-line');
        const textColor = line ? window.getComputedStyle(line).color : 'no text';
        const bgColor = window.getComputedStyle(editor).backgroundColor;

        return {
          index,
          parentClass,
          textColor,
          bgColor,
          hasViewLine: !!line,
        };
      });
    });

    console.log('\n=== Initial State (Light Theme) ===');
    console.log('Found', editorInfo.length, 'Monaco editors');
    editorInfo.forEach(info => {
      console.log(`Editor ${info.index}:`, {
        parent: info.parentClass.substring(0, 50) + '...',
        textColor: info.textColor,
        bgColor: info.bgColor,
        hasViewLine: info.hasViewLine,
      });
    });

    // Check window.monaco theme
    const initialMonacoState = await page.evaluate(() => {
      // @ts-ignore
      const monaco = window.monaco;
      if (!monaco) return { error: 'Monaco not available' };

      return {
        hasSetTheme: typeof monaco.editor.setTheme === 'function',
        editors: monaco.editor.getEditors?.()?.length || 0,
        models: monaco.editor.getModels?.()?.length || 0,
      };
    });

    console.log('\nWindow.monaco state:', initialMonacoState);

    // Toggle to dark theme
    console.log('\n=== Toggling to Dark Theme ===');
    const themeButton = page.locator('button[title*="Switch to"]').first();
    await themeButton.click();
    await page.waitForTimeout(1000);

    // Check state after toggle
    const afterToggleInfo = await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.monaco-editor'));
      return editors.map((editor, index) => {
        const parent = editor.closest('[class*="graphiql"], [class*="schema-viewer"]');
        const parentClass = parent?.className || 'unknown';
        const line = editor.querySelector('.view-line');
        const textColor = line ? window.getComputedStyle(line).color : 'no text';
        const bgColor = window.getComputedStyle(editor).backgroundColor;

        return {
          index,
          parentClass,
          textColor,
          bgColor,
          hasViewLine: !!line,
        };
      });
    });

    console.log('\n=== After Toggle (Dark Theme) ===');
    afterToggleInfo.forEach(info => {
      console.log(`Editor ${info.index}:`, {
        parent: info.parentClass.substring(0, 50) + '...',
        textColor: info.textColor,
        bgColor: info.bgColor,
        hasViewLine: info.hasViewLine,
      });
    });

    // Check which editors changed color
    console.log('\n=== Color Changes ===');
    for (let i = 0; i < Math.min(editorInfo.length, afterToggleInfo.length); i++) {
      const changed = editorInfo[i].textColor !== afterToggleInfo[i].textColor;
      console.log(`Editor ${i}: ${changed ? 'CHANGED' : 'NO CHANGE'} (${editorInfo[i].textColor} → ${afterToggleInfo[i].textColor})`);
    }

    // Manually try to set theme via window.monaco
    console.log('\n=== Manual Theme Setting Test ===');
    await page.evaluate(() => {
      // @ts-ignore
      const monaco = window.monaco;
      if (monaco) {
        console.log('Manually setting theme to vs-dark via window.monaco');
        monaco.editor.setTheme('vs-dark');
      }
    });

    await page.waitForTimeout(500);

    const afterManualSet = await page.evaluate(() => {
      const editors = Array.from(document.querySelectorAll('.monaco-editor'));
      return editors.map((editor, index) => {
        const line = editor.querySelector('.view-line');
        const textColor = line ? window.getComputedStyle(line).color : 'no text';
        return { index, textColor };
      });
    });

    console.log('\n=== After Manual setTheme ===');
    afterManualSet.forEach(info => {
      console.log(`Editor ${info.index}: ${info.textColor}`);
    });

    // Take a screenshot
    await page.screenshot({ path: '/tmp/playground-theme-debug.png', fullPage: true });
    console.log('\nScreenshot saved to /tmp/playground-theme-debug.png');
  });
});
