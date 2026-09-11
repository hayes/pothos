import assert from 'node:assert/strict';
import { readdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const docs = resolve(dirname(fileURLToPath(import.meta.url)), '../content/docs');
const base = new URL(process.argv[2] ?? 'http://localhost:3000');
assert.equal(base.pathname, '/', 'Pass the website origin without a path');
const files = await readdir(docs, { recursive: true });
const routes = files
  .filter((file) => file.endsWith('.mdx'))
  .map((file) => `/docs/${file.replaceAll('\\', '/').slice(0, -4)}`.replace(/\/index$/, ''));
const pages = new Map(
  await Promise.all(
    routes.map(async (route) => {
      const response = await fetch(new URL(route, base), { signal: AbortSignal.timeout(15000) });
      assert.equal(response.status, 200, `${route}: HTTP ${response.status}`);
      const html = await response.text();
      return [
        route,
        {
          ids: new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1])),
          links: new Set([...html.matchAll(/\bhref="([^"]+)"/g)].map((match) => match[1])),
        },
      ];
    }),
  ),
);

const failures = [];
for (const [route, page] of pages) {
  for (const href of page.links) {
    const url = new URL(href.replaceAll('&amp;', '&'), new URL(route, base));
    if (url.origin !== base.origin && url.origin !== 'https://pothos-graphql.dev') {
      continue;
    }
    const path = url.pathname.replace(/\/$/, '');
    if (!/^\/docs(?:\/|$)/.test(path) || path.endsWith('.mdx')) {
      continue;
    }
    const target = pages.get(path);
    if (!target) {
      failures.push(`${route}: ${href} (missing page)`);
    } else if (url.hash && !target.ids.has(decodeURIComponent(url.hash.slice(1)))) {
      failures.push(`${route}: ${href} (missing anchor)`);
    }
  }
}
assert.equal(failures.length, 0, `Broken documentation links:\n${failures.join('\n')}`);
console.log(
  `Passed: internal pages and anchors across ${pages.size} rendered documentation pages.`,
);
