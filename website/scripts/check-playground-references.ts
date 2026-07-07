#!/usr/bin/env tsx

/**
 * CI guardrail: every MDX codefence with `playground example="<id>"`
 * must resolve to a bundle directory under `playground-examples/`.
 *
 * Bundles are flat (e.g. `playground-examples/01-first-schema/`),
 * multi-step (e.g. `playground-examples/errors-plugin/step-1/`), or
 * multi-variant (e.g. `playground-examples/fundamentals-objects/
 * variant-classes/`). A reference to a `-step-N` suffix resolves to the
 * matching step subdirectory; a `-variant-<slug>` suffix resolves to
 * the matching variant subdirectory; an unsuffixed reference resolves
 * to the bundle root, which is valid whether the bundle is flat,
 * multi-step, or multi-variant (all publish an aggregate JSON at the
 * bundle id, the latter being the default variant).
 */

import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const DOCS_DIR = join(ROOT, 'content', 'docs');
const BUNDLES_DIR = join(ROOT, 'playground-examples');

interface Reference {
  file: string;
  line: number;
  id: string;
}

async function walkMdx(dir: string, out: string[] = []): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkMdx(full, out);
    } else if (entry.isFile() && entry.name.endsWith('.mdx')) {
      out.push(full);
    }
  }
  return out;
}

// The `example` attribute inside an opening `<include …>` /
// `<includeregions …>` tag. `[^>]*` spans newlines (it only excludes `>`,
// which never appears inside the quoted `meta`), so multi-line include tags
// are matched as well as single-line ones. `includeregions` is covered by
// the shared `include(?:regions)?` alternation.
const INCLUDE_TAG_RE = /<include(?:regions)?\b[^>]*\bexample=["']([^"']+)["'][^>]*>/g;

async function extractReferences(file: string): Promise<Reference[]> {
  const content = await readFile(file, 'utf-8');
  const lines = content.split('\n');
  const refs: Reference[] = [];

  // 1) Literal code fences: ```ts playground example="…". These are always a
  // single line, so line-scanning is exact and cheap.
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line.includes('playground')) {
      continue;
    }
    if (!line.trimStart().startsWith('```')) {
      continue;
    }
    const match = line.match(/example=["']([^"']+)["']/);
    if (match) {
      refs.push({ file, line: i + 1, id: match[1] });
    }
  }

  // 2) Single-sourced fumadocs `<include>` / `<includeregions>` elements
  // whose `meta` repeats `playground example="<id>"`. Matched over the whole
  // file so a multi-line-authored include tag is still caught; migrating a
  // fence to an include must never drop it from this CI check.
  for (const match of content.matchAll(INCLUDE_TAG_RE)) {
    const line = content.slice(0, match.index ?? 0).split('\n').length;
    refs.push({ file, line, id: match[1] });
  }

  return refs;
}

async function isDirectory(path: string): Promise<boolean> {
  try {
    const s = await stat(path);
    return s.isDirectory();
  } catch {
    return false;
  }
}

async function bundleExists(id: string): Promise<boolean> {
  const stepMatch = id.match(/^(.+)-step-(\d+)$/);
  if (stepMatch) {
    const base = stepMatch[1];
    const stepDir = `step-${stepMatch[2]}`;
    if (await isDirectory(join(BUNDLES_DIR, base, stepDir))) {
      return true;
    }
    // Fall through: a bundle could legitimately be named `<base>-step-<N>`
    // as a flat bundle, though no current bundle does that.
  }

  const variantMatch = id.match(/^(.+)-variant-([a-z0-9-]+)$/);
  if (variantMatch) {
    const base = variantMatch[1];
    const variantDir = `variant-${variantMatch[2]}`;
    if (await isDirectory(join(BUNDLES_DIR, base, variantDir))) {
      return true;
    }
    // Fall through: same rationale as steps.
  }

  return isDirectory(join(BUNDLES_DIR, id));
}

async function main() {
  const mdxFiles = await walkMdx(DOCS_DIR);
  const refs: Reference[] = [];
  for (const file of mdxFiles) {
    refs.push(...(await extractReferences(file)));
  }

  const failures: Reference[] = [];
  for (const ref of refs) {
    if (!(await bundleExists(ref.id))) {
      failures.push(ref);
    }
  }

  if (failures.length > 0) {
    console.error(`Found ${failures.length} broken playground reference(s):`);
    for (const ref of failures) {
      console.error(`  ${relative(ROOT, ref.file)}:${ref.line}  example="${ref.id}"`);
    }
    console.error(`\nExpected each id to resolve to a directory under ${relative(ROOT, BUNDLES_DIR)}/`);
    process.exit(1);
  }

  console.log(`OK: ${refs.length} playground reference(s) across ${mdxFiles.length} MDX file(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
