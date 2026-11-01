import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { docCodeBlocks, parseCodeBlocks } from './doc-code-blocks.mjs';

// Check the actual production outputs: compiling MDX successfully does not
// establish that its source includes survived the separate text pipeline.
const website = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = new URL(process.argv[2] ?? 'http://localhost:3000');
assert.equal(base.pathname, '/', 'Pass the website origin without a path');
const normalize = (text) =>
  text
    .split('\n')
    .map((line) => line.trim())
    .join('\n')
    .trim();
const files = (await readdir(resolve(website, 'content/docs'), { recursive: true }))
  .filter((file) => file.endsWith('.mdx'))
  .sort();
async function get(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(30000) });
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}`);
  if (path.endsWith('.txt') || path.endsWith('.mdx') || path.startsWith('/llms.mdx')) {
    assert.match(
      response.headers.get('content-type') ?? '',
      /^text\/plain\b/,
      `${path}: not plain text`,
    );
  }
  return response.text();
}
const [index, full, sitemap] = await Promise.all([
  get('/llms.txt'),
  get('/llms-full.txt'),
  get('/sitemap.xml'),
]);
const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE,
});
const page = await browser.newPage();
let snippets = 0;
let includes = 0;
let readmeSnippets = 0;
const failures = [];
try {
  for (const file of files) {
    const route = `/docs/${file.replaceAll('\\', '/').slice(0, -4)}`.replace(/\/index$/, '');
    const source = await readFile(resolve(website, 'content/docs', file), 'utf8');
    const blocks = await docCodeBlocks(website, file);
    const [text, internal, html] = await Promise.all([
      get(`${route}.mdx`),
      get(route.replace(/^\/docs/, '/llms.mdx')),
      get(route),
    ]);
    assert.equal(text, internal, `${route}: public and internal text routes disagree`);
    assert.ok(
      index.includes(`https://pothos-graphql.dev${route}.mdx`),
      `${route}: missing from LLM index`,
    );
    assert.ok(
      sitemap.includes(`https://pothos-graphql.dev${route}</loc>`),
      `${route}: missing from sitemap`,
    );
    assert.ok(full.includes(text), `${route}: full corpus differs from per-page text`);
    assert.ok(text.includes(`URL: ${route}\n`), `${route}: incorrect canonical route`);
    assert.doesNotMatch(text, /<include(?:regions)?\b|__img\d+/, `${route}: unresolved content`);
    const rendered = await page.evaluate((markup) => {
      const doc = new DOMParser().parseFromString(markup, 'text/html');
      return [...doc.querySelectorAll('pre code')].map((code) => code.textContent);
    }, html);
    if (
      blocks.some((block) => !rendered.some((code) => normalize(code).includes(normalize(block))))
    ) {
      // Inactive code tabs are mounted by the client when selected. SSR alone
      // cannot establish their coverage, so exercise every definition variant.
      await page.goto(new URL(route, base).href);
      const tabs = page.getByRole('tab');
      for (let index = 0; index < (await tabs.count()); index++) {
        await tabs.nth(index).click();
        rendered.push(...(await page.locator('pre code').allTextContents()));
      }
    }
    const textBlocks = parseCodeBlocks(text).map(normalize);
    for (const block of blocks) {
      const expected = normalize(block);
      if (!textBlocks.includes(expected)) {
        failures.push(`${route}: snippet missing from markdown: ${expected.slice(0, 100)}`);
      }
      if (!rendered.some((code) => normalize(code).includes(expected))) {
        failures.push(`${route}: snippet missing from HTML: ${expected.slice(0, 100)}`);
      }
      snippets++;
    }
    includes += [...source.matchAll(/<include(?:regions)?\b/g)].length;
    if (file.startsWith('plugins/') && /<include(?:regions)?\b/.test(source)) {
      // Prisma Utils has its own package despite living under the Prisma
      // guide. The dedicated Relay auth guide is linked from Scope Auth's
      // README; its full walkthrough deliberately remains a website guide.
      const plugin = file.includes('/prisma-utils.')
        ? 'prisma-utils'
        : file
            .slice('plugins/'.length)
            .split('/')[0]
            .replace(/\.mdx$/, '');
      const readme = await readFile(
        resolve(website, `../packages/plugin-${plugin}/README.md`),
        'utf8',
      );
      if (file === 'plugins/scope-auth/relay-nodes.mdx') {
        assert.ok(
          readme.includes(`https://pothos-graphql.dev${route}`),
          `${route}: README guide link missing`,
        );
      } else {
        assert.doesNotMatch(
          readme,
          /<include(?:regions)?\b/,
          `${plugin}: raw includes in package README`,
        );
        const readmeBlocks = parseCodeBlocks(readme).map(normalize);
        for (const block of await docCodeBlocks(website, file, undefined, { includesOnly: true })) {
          if (!readmeBlocks.includes(normalize(block))) {
            failures.push(
              `${route}: source excerpt missing from package README: ${normalize(block).slice(0, 100)}`,
            );
          }
          readmeSnippets++;
        }
      }
    }
  }
} finally {
  await browser.close();
}
assert.equal(failures.length, 0, failures.join('\n'));
console.log(
  `Passed: ${snippets} snippets (${includes} source includes) across ${files.length} pages in HTML, public/internal markdown, full corpus, LLM index, and sitemap; ${readmeSnippets} source excerpts in package READMEs.`,
);
