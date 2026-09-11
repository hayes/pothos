import assert from 'node:assert/strict';

export async function checkLandingMobile(browser, origin) {
  for (const width of [320, 390, 767]) {
    const page = await browser.newPage({
      viewport: { width, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    page.setDefaultTimeout(60000);
    let loadedPlayground = false;
    page.on('request', (request) => {
      if (request.isNavigationRequest() && new URL(request.url()).pathname === '/playground') {
        loadedPlayground = true;
      }
    });
    try {
      await page.goto(origin);
      await page.locator('pre').waitFor();
      await page.getByRole('button', { name: 'Open menu', exact: true }).click();
      await page.getByRole('button', { name: 'Close menu', exact: true }).click();
      assert.equal(
        await page.locator('iframe').count(),
        0,
        'Mobile homepage must not mount the playground',
      );
      assert.equal(loadedPlayground, false, 'Mobile homepage must not load a playground document');
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        false,
        'Homepage overflows',
      );
      await page.getByRole('link', { name: 'Get started', exact: true }).click();
      await page.waitForURL(/\/docs(?:\/guide)?$/);
      await page.getByRole('heading', { name: 'Getting started', exact: true }).waitFor();
      // Client navigation can paint the heading before scroll restoration and
      // the floating contents bar settle. Require the intended page and wait
      // for its title to be unobscured rather than inspecting one transient frame.
      await page.waitForFunction(() => {
        const heading = document.querySelector('h1');
        if (heading?.textContent !== 'Getting started') {
          return false;
        }
        const rect = heading.getBoundingClientRect();
        const element = document.elementFromPoint(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2,
        );
        return element === heading || heading.contains(element);
      });
      assert.equal(
        await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth),
        false,
        'Docs overflow',
      );
      await page.getByRole('button', { name: 'Open documentation menu', exact: true }).click();
      await page
        .getByRole('complementary', { name: 'Documentation' })
        .getByRole('link', { name: 'Objects', exact: true })
        .click();
      await page.getByRole('heading', { name: 'Objects', exact: true }).waitFor();
      assert.equal(
        await page.evaluate(() => document.body.style.overflow === 'hidden'),
        false,
        'Docs menu must release scrolling after navigation',
      );
      console.log(`PASS ${width}px static homepage, navigation, and docs layout`);
    } finally {
      await page.close();
    }
  }
}
