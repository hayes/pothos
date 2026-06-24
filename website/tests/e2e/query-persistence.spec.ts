import { expect, test } from '@playwright/test';

test.describe('Query Persistence', () => {
  test('default query persists after reload', async ({ page }) => {
    // Navigate to playground
    await page.goto('http://localhost:3001/playground');

    // Wait for playground to load
    await page.waitForSelector('.graphiql-container', { timeout: 10000 });

    // Open examples panel
    await page.click('button[title="Examples"]');

    // Wait for examples list to be visible
    await page.waitForSelector('text=Multi-File Example', { timeout: 5000 });

    // Click on multi-file example
    await page.click('text=Multi-File Example');

    // Wait for example to load
    await page.waitForTimeout(2000);

    // Check URL hash contains state
    const urlBeforeReload = page.url();
    console.log('URL before reload:', urlBeforeReload);

    // Extract hash
    const hashMatch = urlBeforeReload.match(/#(.+)/);
    const hash = hashMatch ? hashMatch[1] : '';
    console.log('Hash:', hash);

    // Parse URL params from hash
    const params = new URLSearchParams(hash);
    const queryBeforeReload = params.get('query');
    console.log('Query in URL before reload:', queryBeforeReload);

    // Switch to GraphQL view to see the query editor
    await page.click('button:has-text("GraphQL")');
    await page.waitForTimeout(2000);

    // Check if we're in GraphQL view
    const isGraphQLView = await page.evaluate(() => {
      return document.querySelector('.graphiql-query-editor') !== null;
    });
    console.log('Is GraphQL view visible:', isGraphQLView);

    // Get the query content from the GraphQL editor
    const queryTextBeforeReload = await page.evaluate(() => {
      const queryEditor = document.querySelector('.graphiql-query-editor .cm-content');
      console.log('Query editor element:', queryEditor);
      console.log('Query editor HTML:', queryEditor?.outerHTML);
      return queryEditor?.textContent || '';
    });
    console.log('Query in editor before reload:', queryTextBeforeReload);

    // Verify query is not empty
    expect(queryTextBeforeReload).not.toBe('');
    expect(queryTextBeforeReload).toContain('query');

    // Reload the page
    await page.reload();

    // Wait for playground to reload
    await page.waitForSelector('.graphiql-container', { timeout: 10000 });
    await page.waitForTimeout(2000);

    // Check URL hash after reload
    const urlAfterReload = page.url();
    console.log('URL after reload:', urlAfterReload);

    const hashAfterReload = urlAfterReload.match(/#(.+)/)?.[1] || '';
    console.log('Hash after reload:', hashAfterReload);

    const paramsAfterReload = new URLSearchParams(hashAfterReload);
    const queryAfterReload = paramsAfterReload.get('query');
    console.log('Query in URL after reload:', queryAfterReload);

    // Get the query content from the GraphQL editor after reload
    const queryTextAfterReload = await page.evaluate(() => {
      const queryEditor = document.querySelector('.graphiql-query-editor .cm-content');
      return queryEditor?.textContent || '';
    });
    console.log('Query in editor after reload:', queryTextAfterReload);

    // Verify query persisted
    expect(queryAfterReload).toBe(queryBeforeReload);
    expect(queryTextAfterReload).toBe(queryTextBeforeReload);
    expect(queryTextAfterReload).toContain('query');
  });
});
