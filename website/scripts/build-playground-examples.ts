#!/usr/bin/env tsx

/**
 * Build script to bundle playground examples from separate files into a JSON bundle
 *
 * This script:
 * 1. Reads example directories from website/public/playground-examples/
 * 2. Loads schema.ts, query.graphql, and metadata.json from each example
 * 3. Bundles them into a single JSON file for dynamic loading
 * 4. Outputs to website/public/playground-examples.json
 */

import { mkdir, readdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ExampleFile {
  filename: string;
  content: string;
  language?: 'typescript' | 'graphql';
  /**
   * Files that come from an external generator (contract emitters,
   * migration tools, seed dumps) get a `generated: true` flag so the
   * playground's Files tab can group them with the read-only
   * `schema.graphql` instead of mixing them in with user-authored
   * source.
   */
  generated?: boolean;
  /**
   * Helper files an example ships for its own wiring (stub-module
   * registration, capture middleware, side-effect imports) that
   * shouldn't appear in the Files tab. By convention, basenames
   * starting with `_` are auto-marked hidden — they still load into
   * Monaco and the runtime bundle, just not the file-picker UI.
   */
  hidden?: boolean;
}

// Filenames that always represent generator output across all current
// examples. Match by full filename so e.g. an example with a
// hand-written `contract.json` could opt out by renaming the file.
const GENERATED_FILENAMES = new Set(['contract.json', 'contract.d.ts', 'seed.sql']);

// A leading `_` on the basename marks an example helper that's bundled
// but invisible in the Files tab.
function isHiddenFilename(filename: string): boolean {
  const basename = filename.includes('/') ? filename.slice(filename.lastIndexOf('/') + 1) : filename;
  return basename.startsWith('_');
}

// Source files carry VS Code `// #region <name>` / `// #endregion <name>`
// markers so the docs can single-source fence bodies from them (fumadocs
// `<include>` + the local remark-multi-region plugin extract named
// regions at MDX compile time). Those marker comments are a docs concern
// only — strip them from the bundled file contents so they never surface
// in the playground editor or the emitted JSON bundles. Removing a whole
// marker line (never a partial edit) leaves the surrounding code byte-for-
// byte identical to the pre-marker source. Matches the `//`-comment marker
// forms fumadocs' extractCodeRegion recognizes (`// #region`, `//#region`,
// `// region`, and the `endregion` variants).
function stripRegionMarkers(content: string): string {
  return content
    .split('\n')
    .filter((line) => !/^\s*\/\/\s*#?(?:end)?region\b/.test(line))
    .join('\n');
}

interface PlaygroundExample {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  category?: 'core' | 'plugins' | 'examples' | 'patterns';
  subcategory?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  order?: number;
  relatedDocs?: string[];
  prerequisites?: string[];
  steps?: Step[];
  variants?: Variant[];
  snippets?: CodeSnippet[];
  files: ExampleFile[];
  defaultQuery: string;
  queries?: Array<{ title?: string; query: string; variables?: string; context?: string }>;
  /** Index into `files` to focus when this example/step is loaded. */
  defaultActiveFile?: number;
}

interface Step {
  id: string;
  title: string;
  description: string;
  order: number;
  /** Filename to focus in the editor when this step opens (e.g.
   * `models/user.ts`). Falls back to the first file in the bundle. */
  defaultActiveFile?: string;
}

interface CodeSnippet {
  label: string;
  filename: string;
  startLine: number;
  endLine: number;
  description?: string;
}

/**
 * A definition-style variant of the same example. Variants implement
 * the SAME schema a different way (e.g. objectRef vs class-backed vs
 * SchemaTypes-generic) and are authored like steps: each non-default
 * variant lives in a `variant-<id>/` subdirectory with its own
 * `schema.ts` (and optional `query.graphql`, which falls back to the
 * base example's query). Exactly one variant is marked `default`; it is
 * built from the example's top-level directory and keeps the base id.
 */
interface Variant {
  id: string;
  title: string;
  order?: number;
  /** The default/primary variant. Built from the example root (no
   * subdirectory) and published under the base example id. */
  default?: boolean;
}

interface ExampleMetadata {
  id: string;
  title: string;
  description?: string;
  tags?: string[];
  category?: 'core' | 'plugins' | 'examples' | 'patterns';
  subcategory?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  order?: number;
  /** Filename to focus on initial load (e.g. `models/user.ts`). For
   * step bundles, this is taken from the matching step's
   * `defaultActiveFile`; for flat examples, from the top-level
   * metadata.json. */
  defaultActiveFile?: string;
  relatedDocs?: string[];
  prerequisites?: string[];
  steps?: Step[];
  variants?: Variant[];
  snippets?: CodeSnippet[];
}

const EXAMPLES_SOURCE_DIR = join(process.cwd(), 'playground-examples');
const EXAMPLES_OUTPUT_DIR = join(process.cwd(), 'public', 'playground-examples');
const INDEX_FILE = join(
  process.cwd(),
  'components',
  'playground',
  'examples',
  'examples-index.generated.ts',
);

/**
 * Check if an example directory contains step subdirectories
 */
async function hasStepDirectories(examplePath: string): Promise<boolean> {
  try {
    const entries = await readdir(examplePath, { withFileTypes: true });
    return entries.some((entry) => entry.isDirectory() && entry.name.startsWith('step-'));
  } catch {
    return false;
  }
}

/**
 * List `variant-<id>/` subdirectories in an example directory.
 */
async function listVariantDirectories(examplePath: string): Promise<string[]> {
  try {
    const entries = await readdir(examplePath, { withFileTypes: true });
    return entries
      .filter((entry) => entry.isDirectory() && entry.name.startsWith('variant-'))
      .map((entry) => entry.name);
  } catch {
    return [];
  }
}

/**
 * Build an example from a flat directory structure
 */
async function buildFlatExample(
  examplePath: string,
  metadata: ExampleMetadata,
): Promise<PlaygroundExample> {
  const files: ExampleFile[] = [];
  const queryFileInfo: Array<{ filename: string; content: string }> = [];
  // Optional `context.json` (or `context.js`) at the example root carries
  // a default JS-literal context applied to every generated operation tab.
  // Examples like `scope-auth-plugin` use this to ship a sample
  // `{ user: { isEmployee: true } }`.
  let defaultContext: string | undefined;

  const exampleFiles = (await readdir(examplePath, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  for (const file of exampleFiles) {
    if (!file.isFile()) {
      continue;
    }

    const filename = file.name;

    // Skip metadata.json + reference-only files (README.md,
    // schema.prisma — kept as source-of-truth on disk but not bundled
    // because the playground has no way to render them yet).
    if (filename === 'metadata.json' || filename === 'README.md' || filename === 'schema.prisma') {
      continue;
    }

    const filePath = join(examplePath, filename);
    // Strip docs-only `// #region` markers so bundled contents match the
    // pre-marker source (see stripRegionMarkers).
    const content = stripRegionMarkers(await readFile(filePath, 'utf-8'));

    // `.ts`, `.d.ts`, `.json`, and `.sql` all ship as inline files;
    // the playground's bundler (execution-engine.ts:bundleFiles)
    // dispatches to esbuild's `ts` / `json` / `text` loader based on
    // extension. `.d.ts` is type-only — esbuild parses it for types
    // but emits no runtime code, which is exactly what we want for
    // contract sidecars.
    if (filename.endsWith('.ts') || filename.endsWith('.json') || filename.endsWith('.sql')) {
      files.push({
        filename,
        content,
        language: filename.endsWith('.ts') ? 'typescript' : undefined,
        ...(GENERATED_FILENAMES.has(filename) ? { generated: true } : {}),
        ...(isHiddenFilename(filename) ? { hidden: true } : {}),
      });
    }
    // Collect .graphql files as query files
    else if (filename.endsWith('.graphql')) {
      queryFileInfo.push({ filename, content });
    } else if (filename === 'context.json' || filename === 'context.js') {
      defaultContext = content;
    }
  }

  // Sort: schema.ts first, then other authored files alphabetically,
  // then generated files at the end (so the editor's file list reads
  // top-to-bottom from "what you edit" to "generator output").
  files.sort((a, b) => {
    if (a.filename === 'schema.ts') {
      return -1;
    }
    if (b.filename === 'schema.ts') {
      return 1;
    }
    if (!!a.generated !== !!b.generated) {
      return a.generated ? 1 : -1;
    }
    return a.filename.localeCompare(b.filename);
  });

  // Use first query file as default, or empty query
  const defaultQuery = queryFileInfo[0]?.content || '{\n  # Add your query here\n}';

  // Build queries array for multiple tabs
  const queries = queryFileInfo.map((fileInfo) => ({
    title: fileInfo.filename.replace(/\.(graphql|gql)$/, ''),
    query: fileInfo.content,
    ...(defaultContext ? { context: defaultContext } : {}),
  }));

  return {
    id: metadata.id,
    title: metadata.title,
    description: metadata.description,
    tags: metadata.tags,
    category: metadata.category,
    subcategory: metadata.subcategory,
    difficulty: metadata.difficulty,
    order: metadata.order,
    relatedDocs: metadata.relatedDocs,
    prerequisites: metadata.prerequisites,
    steps: metadata.steps,
    variants: metadata.variants,
    snippets: metadata.snippets,
    files,
    defaultQuery,
    queries: queries.length > 0 ? queries : undefined,
    defaultActiveFile: resolveDefaultActiveFile(files, metadata.defaultActiveFile),
  };
}

/**
 * Resolve a metadata `defaultActiveFile` filename to an index into the
 * built `files` array. Returns 0 when the filename is missing or
 * doesn't match any bundled file.
 */
function resolveDefaultActiveFile(
  files: ExampleFile[],
  filename: string | undefined,
): number | undefined {
  if (!filename) {
    return undefined;
  }
  const idx = files.findIndex((f) => f.filename === filename);
  return idx >= 0 ? idx : undefined;
}

/**
 * Build examples from step subdirectories
 * Each step directory gets its own JSON bundle: example-id-step-1.json, etc.
 */
async function buildStepExamples(
  examplePath: string,
  metadata: ExampleMetadata,
): Promise<PlaygroundExample[]> {
  const examples: PlaygroundExample[] = [];
  const entries = await readdir(examplePath, { withFileTypes: true });
  const stepDirs = entries
    .filter((entry) => entry.isDirectory() && entry.name.startsWith('step-'))
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const stepDir of stepDirs) {
    const stepPath = join(examplePath, stepDir.name);
    const stepNumber = stepDir.name.replace('step-', '');
    const stepId = `${metadata.id}-step-${stepNumber}`;

    // Find step metadata if available
    const stepMeta = metadata.steps?.find((s) => s.id === stepDir.name);

    const stepExample = await buildFlatExample(stepPath, {
      ...metadata,
      id: stepId,
      title: stepMeta?.title || `${metadata.title} - Step ${stepNumber}`,
      description: stepMeta?.description || metadata.description,
      defaultActiveFile: stepMeta?.defaultActiveFile ?? metadata.defaultActiveFile,
    });

    examples.push(stepExample);
  }

  return examples;
}

/**
 * Build examples from definition-style variants.
 *
 * The default variant is built from the example's top-level directory
 * and keeps the base id (e.g. `fundamentals-objects`). Every other
 * variant lives in a `variant-<id>/` subdirectory and is published at
 * `<base>-variant-<id>` (e.g. `fundamentals-objects-variant-classes`),
 * mirroring how steps publish `<base>-step-<N>`. A variant that ships
 * no `query.graphql` inherits the base example's query.
 */
async function buildVariantExamples(
  examplePath: string,
  metadata: ExampleMetadata,
): Promise<PlaygroundExample[]> {
  const variants = metadata.variants ?? [];
  const defaults = variants.filter((v) => v.default);
  if (defaults.length !== 1) {
    throw new Error(
      `exactly one variant must be marked "default" (found ${defaults.length}: [${variants
        .map((v) => v.id)
        .join(', ')}])`,
    );
  }

  // Cross-check declared variants against on-disk directories so a
  // rename on either side fails loudly instead of silently dropping a
  // variant from the build.
  const variantDirs = new Set(await listVariantDirectories(examplePath));
  const expectedDirs = new Set(variants.filter((v) => !v.default).map((v) => `variant-${v.id}`));
  for (const dir of variantDirs) {
    if (!expectedDirs.has(dir)) {
      throw new Error(`directory ${dir}/ has no matching entry in metadata.variants`);
    }
  }

  const examples: PlaygroundExample[] = [];

  // Base = default variant, built from the top-level directory. It
  // carries the full `variants` list so the docs/UI can resolve labels.
  const baseExample = await buildFlatExample(examplePath, metadata);
  examples.push(baseExample);

  for (const variant of variants) {
    if (variant.default) {
      continue;
    }
    const variantDirName = `variant-${variant.id}`;
    const variantPath = join(examplePath, variantDirName);
    if (!variantDirs.has(variantDirName)) {
      throw new Error(`variant "${variant.id}" is missing its directory ${variantDirName}/`);
    }

    const variantExample = await buildFlatExample(variantPath, {
      ...metadata,
      id: `${metadata.id}-variant-${variant.id}`,
      title: `${metadata.title} — ${variant.title}`,
      description: metadata.description,
      // Variant bundles don't re-advertise the sibling variants; the
      // base example is the single source of the switcher list.
      variants: undefined,
    });

    // A variant that ships no query of its own inherits the base query
    // so "Open in Playground" opens with a runnable operation.
    if (!variantExample.queries) {
      variantExample.defaultQuery = baseExample.defaultQuery;
      variantExample.queries = baseExample.queries;
    }

    examples.push(variantExample);
  }

  return examples;
}

async function buildExamples() {
  console.log('[Build Examples] Starting...');

  // Read all example directories. readdir order is filesystem-dependent,
  // so sort to keep output deterministic across machines / CI.
  const entries = await readdir(EXAMPLES_SOURCE_DIR, { withFileTypes: true });
  const exampleDirs = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  console.log(`[Build Examples] Found ${exampleDirs.length} examples:`, exampleDirs);

  const examples: PlaygroundExample[] = [];
  const failures: Array<{ dirName: string; error: unknown }> = [];

  for (const dirName of exampleDirs) {
    try {
      const examplePath = join(EXAMPLES_SOURCE_DIR, dirName);

      // Read metadata
      const metadataPath = join(examplePath, 'metadata.json');
      const metadataContent = await readFile(metadataPath, 'utf-8');
      const metadata: ExampleMetadata = JSON.parse(metadataContent);

      // Check if this example has step directories
      const hasSteps = await hasStepDirectories(examplePath);
      const variantDirs = await listVariantDirectories(examplePath);
      const hasVariants =
        (Array.isArray(metadata.variants) && metadata.variants.length > 0) ||
        variantDirs.length > 0;

      // Steps and variants don't compose — a stepped variant would need
      // an N×M bundle matrix we deliberately don't support.
      if (hasSteps && hasVariants) {
        throw new Error(
          'example declares BOTH steps and variants; these cannot be combined. ' +
            'Use step-<N>/ subdirectories OR variant-<id>/ subdirectories, not both.',
        );
      }

      if (hasVariants) {
        if (!Array.isArray(metadata.variants) || metadata.variants.length === 0) {
          throw new Error(
            `found variant-*/ directories but metadata.json has no "variants" array (dirs: ${variantDirs.join(', ')})`,
          );
        }
        const variantExamples = await buildVariantExamples(examplePath, metadata);
        examples.push(...variantExamples);
        console.log(
          `[Build Examples] ✓ Built ${metadata.id} (${variantExamples.length - 1} extra variant(s))`,
        );
      } else if (hasSteps) {
        // Build separate examples for each step
        const stepExamples = await buildStepExamples(examplePath, metadata);
        examples.push(...stepExamples);

        // Also build a base example that loads step-1 by default
        // This makes URLs like ?example=errors-plugin work naturally
        if (stepExamples.length > 0) {
          const baseExample = {
            ...stepExamples[0],
            id: metadata.id, // Use base ID (without -step-1 suffix)
            title: metadata.title,
            description: metadata.description,
          };
          examples.push(baseExample);
        }

        console.log(`[Build Examples] ✓ Built ${metadata.id} (${stepExamples.length} steps)`);
      } else {
        // Build single flat example
        const example = await buildFlatExample(examplePath, metadata);
        examples.push(example);
        console.log(
          `[Build Examples] ✓ Built ${metadata.id} (${example.files.length} code files, ${example.queries?.length || 0} queries)`,
        );
      }
    } catch (err) {
      failures.push({ dirName, error: err });
    }
  }

  // Sort examples by ID for consistency
  examples.sort((a, b) => a.id.localeCompare(b.id));

  // Ensure output directory exists
  await mkdir(EXAMPLES_OUTPUT_DIR, { recursive: true });

  // Write individual JSON bundles for each example to public directory
  for (const example of examples) {
    const bundlePath = join(EXAMPLES_OUTPUT_DIR, `${example.id}.json`);
    await writeFile(bundlePath, JSON.stringify(example, null, 2), 'utf-8');
  }

  // Generate TypeScript index file with example IDs and metadata
  const exampleIds = examples.map((e) => e.id);
  const exampleMetadata = examples.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    tags: e.tags || [],
    category: e.category,
    subcategory: e.subcategory,
    difficulty: e.difficulty,
    order: e.order,
    relatedDocs: e.relatedDocs,
    prerequisites: e.prerequisites,
    steps: e.steps,
    variants: e.variants,
    snippets: e.snippets,
  }));

  const indexContent = `/**
 * Auto-generated file - DO NOT EDIT
 * Generated by scripts/build-playground-examples.ts
 * Run: pnpm run build-examples
 */

export interface Step {
  id: string;
  title: string;
  description: string;
  order: number;
  /** Filename to focus in the editor when this step opens. Falls back
   * to the first file in the bundle when unset. */
  defaultActiveFile?: string;
}

export interface CodeSnippet {
  label: string;
  filename: string;
  startLine: number;
  endLine: number;
  description?: string;
}

export interface Variant {
  id: string;
  title: string;
  order?: number;
  /** The default/primary variant, published under the base example id. */
  default?: boolean;
}

export interface ExampleMetadata {
  id: string;
  title: string;
  description?: string;
  tags: string[];
  category?: 'core' | 'plugins' | 'examples' | 'patterns';
  subcategory?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  order?: number;
  relatedDocs?: string[];
  prerequisites?: string[];
  steps?: Step[];
  variants?: Variant[];
  snippets?: CodeSnippet[];
}

/**
 * Available example IDs
 */
export const exampleIds = ${JSON.stringify(exampleIds, null, 2)} as const;

/**
 * Example metadata (lightweight - no code content)
 */
export const exampleMetadata: ExampleMetadata[] = ${JSON.stringify(exampleMetadata, null, 2)};

/**
 * Get metadata for a specific example
 */
export function getExampleMetadata(id: string): ExampleMetadata | undefined {
  return exampleMetadata.find(e => e.id === id);
}

/**
 * Get examples by category
 */
export function getExamplesByCategory(category: 'core' | 'plugins' | 'examples' | 'patterns'): ExampleMetadata[] {
  return exampleMetadata.filter(e => e.category === category);
}

/**
 * Get examples by subcategory
 */
export function getExamplesBySubcategory(subcategory: string): ExampleMetadata[] {
  return exampleMetadata.filter(e => e.subcategory === subcategory);
}

/**
 * Get examples organized by category and subcategory
 */
export function getOrganizedExamples() {
  const organized: Record<string, Record<string, ExampleMetadata[]>> = {};

  for (const example of exampleMetadata) {
    if (!example.category || !example.subcategory) continue;

    if (!organized[example.category]) {
      organized[example.category] = {};
    }
    if (!organized[example.category][example.subcategory]) {
      organized[example.category][example.subcategory] = [];
    }
    organized[example.category][example.subcategory].push(example);
  }

  // Sort examples within each subcategory by order
  for (const category of Object.keys(organized)) {
    for (const subcategory of Object.keys(organized[category])) {
      organized[category][subcategory].sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
    }
  }

  return organized;
}
`;

  // Atomic write: write to a temp file then rename so a crash mid-write
  // can't leave a half-generated index file on disk.
  const tmpIndexFile = `${INDEX_FILE}.tmp`;
  await writeFile(tmpIndexFile, indexContent, 'utf-8');
  await rename(tmpIndexFile, INDEX_FILE);

  console.log(`[Build Examples] ✓ Built ${examples.length} examples`);
  console.log(`[Build Examples] ✓ Index: ${INDEX_FILE}`);

  if (failures.length > 0) {
    console.error(`\n[Build Examples] ${failures.length} example(s) failed to build:`);
    for (const { dirName, error } of failures) {
      console.error(`  ✗ ${dirName}:`, error);
    }
    process.exit(1);
  }

  console.log('[Build Examples] Done!');
}

// Run
buildExamples().catch((err) => {
  console.error('[Build Examples] Fatal error:', err);
  process.exit(1);
});
