import assert from 'node:assert/strict';

export async function checkPlaygroundTabs(browser, origin, examples) {
  const example = examples.reduce((widest, candidate) =>
    candidate.bundle.queries.length > widest.bundle.queries.length ? candidate : widest,
  );
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.setDefaultTimeout(60000);
  try {
    await page.goto(`${origin}/playground?example=${encodeURIComponent(example.id)}`);
    await page.getByRole('button', { name: /schema synced/ }).waitFor();
    const tablist = page.getByRole('tablist', { name: 'Operations' });
    const tabs = tablist.getByRole('tab');
    for (const query of example.bundle.queries) {
      const tab = tablist.getByRole('tab', { name: query.title, exact: true });
      await tab.click();
      assert.equal(await tab.getAttribute('aria-selected'), 'true');
    }
    await tabs.last().focus();
    await page.keyboard.press('Home');
    assert.equal(await tabs.first().getAttribute('aria-selected'), 'true');
    await page.keyboard.press('End');
    assert.equal(await tabs.last().getAttribute('aria-selected'), 'true');
    const bounds = await tabs.last().boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 391);
    await tablist.getByRole('button', { name: 'New operation', exact: true }).click();
    assert.equal(await tabs.count(), example.bundle.queries.length + 1);
    await tablist
      .getByRole('tab', { selected: true })
      .getByRole('button', { name: /^Close / })
      .click();
    assert.equal(await tabs.count(), example.bundle.queries.length);
    console.log(
      `PASS mobile operation tabs: ${example.bundle.queries.length} tabs, keyboard, add/close`,
    );
  } finally {
    await page.close();
  }
}
