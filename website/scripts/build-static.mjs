#!/usr/bin/env node
// Builds the site as plain static files in `out/` for hosts with no server, such as
// GitHub Pages. Run after the workspace packages and codegen are built (see `build-ci`).
//
// Static hosts can't run Next's rewrites or redirects, so this script also writes:
// - `docs/<page>.mdx` copies of `/llms.mdx/<page>` (replaces the `.mdx` rewrite)
// - small redirect pages for the old URLs in next.config.mjs
// - `.nojekyll` (so GitHub Pages serves `_next/`) and `CNAME` (the custom domain)

import { execSync } from 'node:child_process';
import { cpSync, mkdirSync, readdirSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';

const DOMAIN = process.env.SITE_DOMAIN ?? 'pothos-graphql.dev';
const out = 'out';

// The review API is development-only and always dynamic, which static export rejects.
const reviewApi = 'app/(docs)/api/review';
const reviewApiAside = '.review-api-aside';

renameSync(reviewApi, reviewApiAside);
try {
  execSync('next build', { stdio: 'inherit', env: { ...process.env, STATIC_EXPORT: '1' } });
} finally {
  renameSync(reviewApiAside, reviewApi);
}

// `/docs/<page>.mdx` serves the page as plain markdown. The static build writes them
// as `llms.mdx/<page>.mdx` (see app/llms.mdx/[[...slug]]/route.ts).
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

const llmsDir = join(out, 'llms.mdx');
for (const file of walk(llmsDir)) {
  const path = relative(llmsDir, file);
  const target = path === 'index.mdx' ? join(out, 'docs.mdx') : join(out, 'docs', path);
  mkdirSync(dirname(target), { recursive: true });
  cpSync(file, target);
}

// Mirrors `redirects()` in next.config.mjs.
const redirects = {
  '/docs/guide': '/docs/',
  '/plugins': '/docs/plugins/',
  '/docs/sponsors': '/sponsors/',
  '/docs/resources': '/resources/',
};

for (const [from, to] of Object.entries(redirects)) {
  // Like on Vercel, a redirect wins over a page at the same URL (e.g. the old
  // `docs/sponsors` page still exists but readers should land on `/sponsors`).
  const dir = join(out, from);
  mkdirSync(dir, { recursive: true });
  writeFileSync(
    join(dir, 'index.html'),
    `<!doctype html><meta charset="utf-8"><title>Redirecting…</title><link rel="canonical" href="${to}"><meta http-equiv="refresh" content="0; url=${to}"><script>location.replace(${JSON.stringify(to)} + location.hash)</script><a href="${to}">Moved here</a>\n`,
  );
}

writeFileSync(join(out, '.nojekyll'), '');
writeFileSync(join(out, 'CNAME'), `${DOMAIN}\n`);

console.log(`Static site written to ${out}/`);
