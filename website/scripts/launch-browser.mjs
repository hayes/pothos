import { chromium } from 'playwright';

// The playground loads Monaco, esbuild-wasm and hundreds of type declarations from public CDNs, and
// every check opens a fresh page. Fetch each CDN URL once per run and serve later requests from
// memory, retrying slow or failed fetches, so a stalled CDN request doesn't hang a check.
const cdn = /^https:\/\/(?:cdn\.jsdelivr\.net|data\.jsdelivr\.com|unpkg\.com)\//;
const responses = new Map();

async function fetchOnce(route) {
  for (let attempt = 1; ; attempt++) {
    try {
      const response = await route.fetch({ timeout: 20000 });
      if (response.status() >= 500 && attempt < 3) {
        continue;
      }
      // The body arrives decoded, so drop the headers that describe the encoded one.
      const { 'content-encoding': _, 'content-length': __, ...headers } = response.headers();
      return { status: response.status(), headers, body: await response.body() };
    } catch (error) {
      if (attempt >= 3) {
        throw error;
      }
    }
  }
}

async function serveFromCache(route) {
  const url = route.request().url();
  if (route.request().method() !== 'GET') {
    return route.continue();
  }
  if (!responses.has(url)) {
    const pending = fetchOnce(route);
    responses.set(url, pending);
    pending.catch(() => responses.delete(url));
  }
  let response;
  try {
    response = await responses.get(url);
  } catch {
    // The fetch failed, or the page that started it closed first.
    return route.continue().catch(() => {});
  }
  return route.fulfill(response);
}

export async function launchBrowser() {
  const browser = await chromium.launch({
    headless: true,
    ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE
      ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE }
      : {}),
  });
  const newPage = browser.newPage.bind(browser);
  browser.newPage = async (options) => {
    const page = await newPage(options);
    await page.route(cdn, serveFromCache);
    return page;
  };
  return browser;
}
