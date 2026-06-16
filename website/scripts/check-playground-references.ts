#!/usr/bin/env tsx

/**
 * CI guardrail: every MDX codefence with `playground example="<id>"`
 * must resolve to a bundle directory under `playground-examples/`.
 *
 * Bundles are flat (e.g. `playground-examples/01-first-schema/`) or
 * multi-step (e.g. `playground-examples/errors-plugin/step-1/`). A
 * reference to a `-step-N` suffix resolves to the matching step
 * subdirectory; an unsuffixed reference resolves to the bundle root,
 * which is valid whether the bundle is flat or multi-step (multi-step
 * bundles also publish an aggregate JSON at the bundle id).
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

async function extractReferences(file: string): Promise<Reference[]> {
  const content = await readFile(file, 'utf-8');
  const lines = content.split('\n');
  const refs: Reference[] = [];
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
