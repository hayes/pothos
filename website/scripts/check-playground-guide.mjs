import assert from 'node:assert/strict';

export async function checkPlaygroundGuide(browser, origin) {
  for (const width of [1440, 390, 320]) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.setDefaultTimeout(60000);
    try {
      await page.goto(`${origin}/playground?example=plugin-drizzle`);
      const guide = page.getByRole('complementary', { name: 'Example guide' });
      await guide.waitFor();
      const instructions = guide.getByRole('listitem');
      assert.equal(
        await instructions.count(),
        5,
        'Show each Drizzle task as a separate instruction',
      );
      const text = await guide.innerText();
      for (const instruction of [
        '04-pagination',
        'Variables.after',
        '10-attachments',
        'hasCaption',
        '02-aliases',
        '03-viewer',
        '09-variant',
        'userId',
        'Reset restores the seed',
      ]) {
        assert.ok(text.includes(instruction), `Preserve ${instruction}`);
      }
      for (const element of [
        guide,
        ...(await instructions.all()),
        guide.getByRole('link'),
        guide.getByRole('button'),
      ]) {
        const box = await element.boundingBox();
        assert.ok(
          box && box.x >= 0 && box.x + box.width <= width,
          `${width}px: guide content stays inside the viewport`,
        );
      }
      assert.equal(
        await guide.getByRole('link', { name: 'Read the guide' }).getAttribute('href'),
        '/docs/plugins/drizzle',
      );
      await Promise.all([
        page.waitForEvent('load'),
        guide.getByRole('button', { name: 'Reset example' }).click(),
      ]);
      await guide.waitFor();
      assert.equal(await guide.getByRole('listitem').count(), 5, 'Reset preserves the guide');
      console.log(`PASS ${width}px guide instructions, actions, and reset`);
    } finally {
      await page.close();
    }
  }
  const page = await browser.newPage({ viewport: { width: 390, height: 900 } });
  page.setDefaultTimeout(60000);
  try {
    await page.goto(`${origin}/playground?example=playground-tour`);
    const guide = page.getByRole('complementary', { name: 'Example guide' });
    await guide.getByText('Run and edit.', { exact: true }).waitFor();
    assert.equal(
      await guide.getByRole('listitem').count(),
      0,
      'Keep single-line descriptions as paragraphs',
    );
    await page.getByRole('button', { name: /schema synced/ }).waitFor();
    await page.getByRole('button', { name: 'Next →', exact: true }).click();
    await guide.getByText('Explore a schema.', { exact: true }).waitFor();
    assert.ok((await guide.innerText()).includes('Change minimumHeight in Variables'));
    await page.getByRole('button', { name: '← Prev', exact: true }).click();
    await guide.getByText('Run and edit.', { exact: true }).waitFor();
    assert.ok((await guide.innerText()).includes('Change Sam in the query'));
    console.log('PASS mobile single-line guide and step navigation');
  } finally {
    await page.close();
  }
}
