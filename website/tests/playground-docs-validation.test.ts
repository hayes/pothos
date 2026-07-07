import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';
import { extractCodeRegion, parseRegionSpecifier } from '../lib/remark-multi-region';

const WEBSITE_ROOT = join(__dirname, '..');
const DOCS_DIR = join(WEBSITE_ROOT, 'content/docs');
const EXAMPLES_DIR = join(WEBSITE_ROOT, 'playground-examples');
const EXAMPLES_INDEX = join(
  WEBSITE_ROOT,
  'components/playground/examples/examples-index.generated.ts',
);

// ---------------------------------------------------------------------------
// The single-source migration replaced most literal `playground` code fences
// with fumadocs `<include>` / local `<includeregions>` elements that pull the
// displayed body straight out of a bundle's `schema.ts` at MDX compile time
// (see lib/remark-multi-region.ts + the `// #region` markers). This test is
// the deterministic guardrail the design doc called for: it resolves EVERY
// include's target file + named regions with the exact same extraction logic
// the remark plugins use, so a typo'd region name or a marker deleted from a
// bundle fails here instead of only at `next build`.
//
// A small, enumerated set of fences is deliberately kept literal — each one
// recomposes code that cannot exist as a single contiguous region in the
// bundle (a curated subset, a multi-file project layout, or a bundle whose
// schema.ts carries no region markers). Those keep the legacy containment
// check (the schema must still contain the shown code) and are pinned by an
// allowlist below so no NEW un-migrated literal fence can slip in unnoticed.
// ---------------------------------------------------------------------------

interface LiteralFence {
  file: string;
  line: number;
  exampleId: string;
  codeSnippet: string;
  language?: string;
  queryFile?: string;
}

interface IncludeReference {
  file: string;
  line: number;
  /** `include` (single region) or `includeregions` (comma-separated). */
  tag: 'include' | 'includeregions';
  /** Absolute path of the referenced target file. */
  targetPath: string;
  /** Region names to extract (empty = whole-file include). */
  regionNames: string[];
  /** exampleId parsed from the element's `meta`, if present. */
  exampleId?: string;
  /** Raw specifier text, for diagnostics. */
  specifier: string;
}

/**
 * Extract literal ```lang playground example="…"``` code fences.
 *
 * Line-based on purpose: it must NOT descend into `<include>` bodies (those
 * carry no literal fence) and must tolerate the doc-of-the-feature fences in
 * playground.mdx. Fences without an `example=` (bare syntax demos) are
 * skipped — there is nothing to existence- or containment-check.
 */
function extractLiteralFences(): LiteralFence[] {
  const mdxFiles = globSync('**/*.mdx', { cwd: DOCS_DIR });
  const fences: LiteralFence[] = [];

  for (const file of mdxFiles) {
    const content = readFileSync(join(DOCS_DIR, file), 'utf-8');
    const lines = content.split('\n');

    let inCodeBlock = false;
    let exampleId: string | null = null;
    let language: string | undefined;
    let queryFile: string | undefined;
    let codeBlockStart = -1;
    let snippet: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      const open = line.match(
        /^```(\w+)?\s+playground\s+example="([^"]+)"(?:\s+queryFile="([^"]+)")?/,
      );
      if (open) {
        inCodeBlock = true;
        language = open[1];
        exampleId = open[2];
        queryFile = open[3];
        codeBlockStart = i + 1;
        snippet = [];
        continue;
      }

      if (inCodeBlock && line.trim() === '```') {
        if (exampleId) {
          fences.push({
            file,
            line: codeBlockStart,
            exampleId,
            codeSnippet: snippet.join('\n').trim(),
            language,
            queryFile,
          });
        }
        inCodeBlock = false;
        exampleId = null;
        language = undefined;
        queryFile = undefined;
        snippet = [];
        continue;
      }

      if (inCodeBlock) {
        snippet.push(line);
      }
    }
  }

  return fences;
}

/**
 * Extract every `<include>` / `<includeregions>` element from the docs and
 * resolve its target path + region list exactly as the remark plugins do:
 *   - `cwd` attribute -> path is relative to the website/ collection root
 *     (fumadocs' `file.cwd`); otherwise relative to the MDX file's directory
 *     (fumadocs' `file.dirname`).
 *   - `path#a,b,c` splits into a file path and region names via the shared
 *     `parseRegionSpecifier` helper.
 * A DOTALL regex is used so multi-line include forms are matched too.
 */
function extractIncludeReferences(): IncludeReference[] {
  const mdxFiles = globSync('**/*.mdx', { cwd: DOCS_DIR });
  const refs: IncludeReference[] = [];
  // <include …>spec</include> and <includeregions …>spec</includeregions>.
  // The `\1` backreference keeps the two tag names from cross-matching, and
  // `[\s\S]*?` spans newlines for multi-line authoring.
  const tagRe = /<(include|includeregions)\b([^>]*)>([\s\S]*?)<\/\1>/g;

  for (const file of mdxFiles) {
    const fullPath = join(DOCS_DIR, file);
    const content = readFileSync(fullPath, 'utf-8');

    for (const match of content.matchAll(tagRe)) {
      const [full, tag, attrs, body] = match;
      const specifier = body.trim();
      if (!specifier) {
        continue;
      }
      const line = content.slice(0, match.index ?? 0).split('\n').length;
      const hasCwd = /(^|\s)cwd(\s|=|$)/.test(attrs);
      const base = hasCwd ? WEBSITE_ROOT : dirname(fullPath);
      const { relativePath, regionNames } = parseRegionSpecifier(specifier);
      const exampleMatch = attrs.match(/example=["']([^"']+)["']/);

      refs.push({
        file,
        line,
        tag: tag as 'include' | 'includeregions',
        targetPath: resolve(base, relativePath),
        regionNames,
        exampleId: exampleMatch?.[1],
        specifier,
      });
      void full;
    }
  }

  return refs;
}

function getAvailableExamples(): Set<string> {
  try {
    const dirs = readdirSync(EXAMPLES_DIR, { withFileTypes: true });
    return new Set(dirs.filter((d) => d.isDirectory()).map((d) => d.name));
  } catch {
    return new Set();
  }
}

/**
 * Resolve whether a referenced example ID has a real bundle backing it.
 * A `-step-N` suffix resolves to that step subdirectory, a `-variant-<slug>`
 * suffix to that variant subdirectory; otherwise it must be a top-level
 * directory. Mirrors scripts/check-playground-references.ts.
 */
function exampleReferenceExists(id: string, availableExamples: Set<string>): boolean {
  if (availableExamples.has(id)) {
    return true;
  }

  const stepMatch = id.match(/^(.+)-step-(\d+)$/);
  if (stepMatch) {
    const [, base, stepNumber] = stepMatch;
    if (availableExamples.has(base)) {
      try {
        const stat = readdirSync(join(EXAMPLES_DIR, base), { withFileTypes: true });
        return stat.some((e) => e.isDirectory() && e.name === `step-${stepNumber}`);
      } catch {
        return false;
      }
    }
  }

  const variantMatch = id.match(/^(.+)-variant-([a-z0-9-]+)$/);
  if (variantMatch) {
    const [, base, slug] = variantMatch;
    if (availableExamples.has(base)) {
      try {
        const stat = readdirSync(join(EXAMPLES_DIR, base), { withFileTypes: true });
        return stat.some((e) => e.isDirectory() && e.name === `variant-${slug}`);
      } catch {
        return false;
      }
    }
  }

  return false;
}

/**
 * Read example schema file content for a literal-fence containment check.
 * Variant/step ids resolve to their own subdirectory; a flat id reads its
 * top-level schema.ts.
 */
function getExampleSchemaContent(exampleId: string): string {
  if (existsSync(join(EXAMPLES_DIR, exampleId, 'schema.ts'))) {
    return readFileSync(join(EXAMPLES_DIR, exampleId, 'schema.ts'), 'utf-8');
  }

  const variantMatch = exampleId.match(/^(.+)-variant-([a-z0-9-]+)$/);
  if (variantMatch) {
    const [, base, slug] = variantMatch;
    try {
      return readFileSync(join(EXAMPLES_DIR, base, `variant-${slug}`, 'schema.ts'), 'utf-8');
    } catch {
      return '';
    }
  }

  const stepMatch = exampleId.match(/^(.+)-step-(\d+)$/);
  if (stepMatch) {
    const [, base, stepNumber] = stepMatch;
    try {
      return readFileSync(join(EXAMPLES_DIR, base, `step-${stepNumber}`, 'schema.ts'), 'utf-8');
    } catch {
      return '';
    }
  }

  return '';
}

function getExampleQueryContent(exampleId: string, queryFile: string): string {
  try {
    return readFileSync(join(EXAMPLES_DIR, exampleId, `${queryFile}.graphql`), 'utf-8');
  } catch {
    try {
      const entries = readdirSync(join(EXAMPLES_DIR, exampleId), { withFileTypes: true });
      const stepDirs = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('step-'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
      for (const dir of stepDirs) {
        try {
          return readFileSync(join(EXAMPLES_DIR, exampleId, dir, `${queryFile}.graphql`), 'utf-8');
        } catch {
          /* try next step */
        }
      }
      return '';
    } catch {
      return '';
    }
  }
}

function normalizeCode(code: string): string {
  return code
    .replace(/\/\/.*$/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function schemaContainsSnippet(schemaContent: string, snippet: string): boolean {
  const normalizedSchema = normalizeCode(schemaContent);
  const normalizedSnippet = normalizeCode(snippet);

  if (normalizedSnippet.length < 20) {
    return normalizedSchema.includes(normalizedSnippet);
  }

  const snippetStatements = normalizedSnippet
    .split(/[;{}]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (snippetStatements.length === 0) {
    return normalizedSchema.includes(normalizedSnippet);
  }

  const matching = snippetStatements.filter((stmt) => normalizedSchema.includes(stmt));
  return matching.length >= snippetStatements.length * 0.8;
}

// ---------------------------------------------------------------------------
// Deliberately-literal fences. Keyed by docs-relative MDX path -> the multiset
// of exampleIds still authored as literal `playground` fences on that page.
// Every entry recomposes code that cannot be single-sourced as one contiguous
// region from the bundle. The test asserts the ACTUAL literal fences are a
// SUBSET of this allowlist (so migrating one away — fewer literals — stays
// green under concurrent edits, but adding an un-migrated fence fails).
//
// playground.mdx is exempt entirely: it is the page that documents the fence
// syntax itself, so its literal fences are illustrative, not real embeds.
// ---------------------------------------------------------------------------
const META_DOC = 'playground.mdx';

const LITERAL_FENCE_ALLOWLIST: Record<string, string[]> = {
  // Minimal `queryType` shown with a single `characterCount` field; the real
  // bundle's Query root carries several more fields, so no single region
  // reproduces this curated teaching subset.
  'fundamentals/resolvers.mdx': ['fundamentals-resolvers'],
  // The `timestampInputs` helper is shown with an explicit
  // `InputFieldBuilder<…>` annotation for teaching; the runnable bundle omits
  // it, so the shown form is a recomposition, not a slice.
  'patterns/reusable-fields.mdx': ['reusable-input-pattern'],
  // Four curated `fieldWithInput` excerpts that each drop the interface/Map
  // boilerplate between the shown statements. The bundle's schema.ts carries
  // no region markers; single-sourcing would require re-cutting the page.
  'plugins/with-input.mdx': [
    'with-input-plugin',
    'with-input-plugin',
    'with-input-plugin',
    'with-input-plugin',
  ],
  // A `players`/`nodes` connection excerpt authored between two migrated
  // includes; the shown block interleaves helper code not contiguous in the
  // bundle.
  'plugins/relay.mdx': ['relay-plugin'],
  // A multi-FILE project layout (builder.ts + race.ts + …) shown as adjacent
  // fences. It cannot be one region of one schema.ts by construction.
  'patterns/project-layout.mdx': ['patterns-project-layout-step-2'],
};

describe('Playground Documentation Validation', () => {
  const literalFences = extractLiteralFences();
  const includeRefs = extractIncludeReferences();
  const availableExamples = getAvailableExamples();

  it('should find playground references in documentation', () => {
    const total = literalFences.length + includeRefs.length;
    expect(total).toBeGreaterThan(0);
    console.log(
      `Found ${literalFences.length} literal playground fence(s) and ${includeRefs.length} include element(s) in documentation`,
    );
  });

  it('should have all referenced examples available', () => {
    const withExample = [
      ...literalFences.map((f) => ({ file: f.file, line: f.line, id: f.exampleId })),
      ...includeRefs
        .filter((r) => r.exampleId)
        .map((r) => ({ file: r.file, line: r.line, id: r.exampleId as string })),
    ];

    const missing = withExample.filter((ref) => !exampleReferenceExists(ref.id, availableExamples));

    if (missing.length > 0) {
      const details = missing.map(
        (ref) => `  - ${ref.file}:${ref.line} references missing example "${ref.id}"`,
      );
      throw new Error(
        `Found ${missing.length} references to missing examples:\n${details.join('\n')}`,
      );
    }
  });

  it('should resolve every <include>/<includeregions> target file and named region', () => {
    expect(includeRefs.length).toBeGreaterThan(0);

    const failures: string[] = [];

    for (const ref of includeRefs) {
      if (!existsSync(ref.targetPath)) {
        failures.push(
          `  - ${ref.file}:${ref.line} <${ref.tag}> target file not found: ${ref.specifier}`,
        );
        continue;
      }

      const content = readFileSync(ref.targetPath, 'utf-8');
      for (const region of ref.regionNames) {
        try {
          extractCodeRegion(content, region);
        } catch {
          failures.push(
            `  - ${ref.file}:${ref.line} <${ref.tag}> region "${region}" does not resolve in ${ref.specifier}`,
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Found ${failures.length} unresolved include reference(s):\n${failures.join('\n')}`,
      );
    }
  });

  it('should keep every remaining literal playground fence inside the deliberate allowlist', () => {
    // Any literal `playground example="…"` fence outside playground.mdx must be
    // accounted for in LITERAL_FENCE_ALLOWLIST. Compare as multisets so a
    // second literal fence for the same example on a page is caught too.
    const allowedCounts = new Map<string, number>();
    for (const [file, ids] of Object.entries(LITERAL_FENCE_ALLOWLIST)) {
      for (const id of ids) {
        const key = `${file}::${id}`;
        allowedCounts.set(key, (allowedCounts.get(key) ?? 0) + 1);
      }
    }

    const actualCounts = new Map<string, { count: number; line: number }>();
    for (const fence of literalFences) {
      if (fence.file === META_DOC) {
        continue;
      }
      const key = `${fence.file}::${fence.exampleId}`;
      const prev = actualCounts.get(key);
      actualCounts.set(key, { count: (prev?.count ?? 0) + 1, line: prev?.line ?? fence.line });
    }

    const violations: string[] = [];
    for (const [key, { count, line }] of actualCounts) {
      const allowed = allowedCounts.get(key) ?? 0;
      if (count > allowed) {
        const [file, id] = key.split('::');
        violations.push(
          `  - ${file}:${line} has ${count} literal fence(s) for "${id}" but only ${allowed} allowlisted. ` +
            'Migrate it to <include>/<includeregions> or add it to LITERAL_FENCE_ALLOWLIST with a reason.',
        );
      }
    }

    if (violations.length > 0) {
      throw new Error(
        `Found ${violations.length} un-allowlisted literal playground fence(s):\n${violations.join('\n')}`,
      );
    }
  });

  it('should have example schemas that contain the referenced literal snippets', () => {
    const failures: string[] = [];

    for (const ref of literalFences) {
      // Step fences show curated fragments that can span sibling steps, so
      // (matching prior behaviour) they are existence-checked only, not
      // containment-checked.
      const isVariantRef = /-variant-[a-z0-9-]+$/.test(ref.exampleId);
      const isStepRef = /-step-\d+$/.test(ref.exampleId);
      if (isStepRef) {
        continue;
      }
      if (!isVariantRef && !availableExamples.has(ref.exampleId)) {
        continue; // existence covered above
      }
      if (isVariantRef && !exampleReferenceExists(ref.exampleId, availableExamples)) {
        continue;
      }

      const isGraphQL = ref.language === 'graphql' || ref.language === 'gql';

      if (isGraphQL && ref.queryFile) {
        const queryContent = getExampleQueryContent(ref.exampleId, ref.queryFile);
        if (!queryContent) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" has no ${ref.queryFile}.graphql file`,
          );
          continue;
        }
        if (!schemaContainsSnippet(queryContent, ref.codeSnippet)) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" query file "${ref.queryFile}.graphql" doesn't contain the referenced snippet`,
          );
        }
      } else {
        const schemaContent = getExampleSchemaContent(ref.exampleId);
        if (!schemaContent) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" has no schema.ts file`,
          );
          continue;
        }
        if (!schemaContainsSnippet(schemaContent, ref.codeSnippet)) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" schema doesn't contain the referenced snippet`,
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(`Found ${failures.length} code snippet mismatches:\n${failures.join('\n')}`);
    }
  });

  it('should have valid example metadata', () => {
    const failures: string[] = [];

    for (const exampleId of Array.from(availableExamples)) {
      const metadataPath = join(EXAMPLES_DIR, exampleId, 'metadata.json');
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));

        if (!metadata.id) {
          failures.push(`  - ${exampleId}/metadata.json: missing "id" field`);
        }
        if (metadata.id !== exampleId) {
          failures.push(
            `  - ${exampleId}/metadata.json: "id" field (${metadata.id}) doesn't match directory name`,
          );
        }
        if (!metadata.title) {
          failures.push(`  - ${exampleId}/metadata.json: missing "title" field`);
        }
        if (!metadata.category) {
          failures.push(`  - ${exampleId}/metadata.json: missing "category" field`);
        }
        if (typeof metadata.order !== 'number') {
          failures.push(`  - ${exampleId}/metadata.json: missing or invalid "order" field`);
        }
      } catch (error) {
        failures.push(`  - ${exampleId}/metadata.json: ${error}`);
      }
    }

    if (failures.length > 0) {
      throw new Error(`Found ${failures.length} metadata issues:\n${failures.join('\n')}`);
    }
  });

  it('should have all prerequisites pointing at real example IDs', () => {
    const failures: string[] = [];

    for (const exampleId of Array.from(availableExamples)) {
      const metadataPath = join(EXAMPLES_DIR, exampleId, 'metadata.json');
      let metadata: { prerequisites?: unknown };
      try {
        metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      } catch {
        continue; // covered by the metadata test above
      }

      const prereqs = metadata.prerequisites;
      if (!Array.isArray(prereqs)) {
        continue;
      }

      for (const prereq of prereqs) {
        if (typeof prereq !== 'string') {
          failures.push(`  - ${exampleId}: non-string prerequisite ${JSON.stringify(prereq)}`);
          continue;
        }
        if (!availableExamples.has(prereq)) {
          failures.push(
            `  - ${exampleId}: prerequisite "${prereq}" does not exist in playground-examples/`,
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Found ${failures.length} broken prerequisite reference(s):\n${failures.join('\n')}`,
      );
    }
  });

  it('should have all relatedDocs pointing at real doc files', () => {
    const failures: string[] = [];

    function docExists(docPath: string): boolean {
      const trimmed = docPath.replace(/^\/+/, '').replace(/^docs\//, '');
      const base = join(DOCS_DIR, trimmed);
      try {
        readFileSync(`${base}.mdx`, 'utf-8');
        return true;
      } catch {
        /* fall through */
      }
      try {
        readFileSync(join(base, 'index.mdx'), 'utf-8');
        return true;
      } catch {
        return false;
      }
    }

    for (const exampleId of Array.from(availableExamples)) {
      const metadataPath = join(EXAMPLES_DIR, exampleId, 'metadata.json');
      let metadata: { relatedDocs?: unknown };
      try {
        metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
      } catch {
        continue;
      }

      const related = metadata.relatedDocs;
      if (!Array.isArray(related)) {
        continue;
      }

      for (const doc of related) {
        if (typeof doc !== 'string') {
          failures.push(`  - ${exampleId}: non-string relatedDocs entry ${JSON.stringify(doc)}`);
          continue;
        }
        if (!docExists(doc)) {
          failures.push(
            `  - ${exampleId}: relatedDocs "${doc}" does not resolve under content/docs/`,
          );
        }
      }
    }

    if (failures.length > 0) {
      throw new Error(
        `Found ${failures.length} broken relatedDocs reference(s):\n${failures.join('\n')}`,
      );
    }
  });

  it('should have examples index file generated', () => {
    expect(() => readFileSync(EXAMPLES_INDEX, 'utf-8')).not.toThrow();

    const indexContent = readFileSync(EXAMPLES_INDEX, 'utf-8');
    expect(indexContent).toContain('export const exampleIds');
    expect(indexContent).toContain('export const exampleMetadata');
  });

  it('should list all examples by category and order', () => {
    const examplesByCategory: Record<string, string[]> = {};

    for (const exampleId of Array.from(availableExamples)) {
      const metadataPath = join(EXAMPLES_DIR, exampleId, 'metadata.json');
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        const category = metadata.category || 'uncategorized';
        (examplesByCategory[category] ??= []).push(exampleId);
      } catch {
        // Skip invalid metadata
      }
    }

    for (const category in examplesByCategory) {
      examplesByCategory[category].sort((a, b) => {
        try {
          const metadataA = JSON.parse(
            readFileSync(join(EXAMPLES_DIR, a, 'metadata.json'), 'utf-8'),
          );
          const metadataB = JSON.parse(
            readFileSync(join(EXAMPLES_DIR, b, 'metadata.json'), 'utf-8'),
          );
          return (metadataA.order || 999) - (metadataB.order || 999);
        } catch {
          return 0;
        }
      });
    }

    console.log('\nCurrent example structure:');
    for (const [category, examples] of Object.entries(examplesByCategory)) {
      console.log(`\n${category}:`);
      for (const exampleId of examples) {
        console.log(`  - ${exampleId}`);
      }
    }

    expect(examplesByCategory.core).toBeDefined();
    expect(examplesByCategory.core.length).toBeGreaterThan(0);
  });

  it.skip('should have valid GraphQL queries that work against their schemas', () => {
    // Requires compiling TypeScript schemas in Node; the playground compiler
    // uses esbuild-wasm which is browser-only. Query validation happens at
    // runtime in the playground.
    expect(true).toBe(true);
  });
});
