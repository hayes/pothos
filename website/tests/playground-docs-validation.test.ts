import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { globSync } from 'glob';
import { describe, expect, it } from 'vitest';

const DOCS_DIR = join(__dirname, '../content/docs');
const EXAMPLES_DIR = join(__dirname, '../playground-examples');
const EXAMPLES_INDEX = join(
  __dirname,
  '../components/playground/examples/examples-index.generated.ts',
);

interface PlaygroundReference {
  file: string;
  line: number;
  exampleId: string;
  codeSnippet: string;
  language?: string;
  queryFile?: string;
  /**
   * True when this reference came from a fumadocs `<include>` /
   * `<includeregions>` element rather than a literal code fence. For these
   * the displayed body is single-sourced from `schema.ts` at MDX compile
   * time (see lib/remark-multi-region.ts + the `#region` markers), so there
   * is no hand-copied snippet to containment-check — the marker extraction
   * itself is the integrity guarantee. Existence of the referenced example
   * is still validated below.
   */
  isInclude?: boolean;
}

/**
 * Extract all playground references from MDX files
 */
function extractPlaygroundReferences(): PlaygroundReference[] {
  const mdxFiles = globSync('**/*.mdx', { cwd: DOCS_DIR });
  const references: PlaygroundReference[] = [];

  for (const file of mdxFiles) {
    const fullPath = join(DOCS_DIR, file);
    const content = readFileSync(fullPath, 'utf-8');
    const lines = content.split('\n');

    let inCodeBlock = false;
    let currentExampleId: string | null = null;
    let currentLanguage: string | undefined;
    let currentQueryFile: string | undefined;
    let codeBlockStart = -1;
    let codeSnippet: string[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Check for code block with playground example
      const codeBlockMatch = line.match(
        /^```(\w+)?\s+playground\s+example="([^"]+)"(?:\s+queryFile="([^"]+)")?/,
      );
      if (codeBlockMatch) {
        inCodeBlock = true;
        currentLanguage = codeBlockMatch[1];
        currentExampleId = codeBlockMatch[2];
        currentQueryFile = codeBlockMatch[3];
        codeBlockStart = i + 1;
        codeSnippet = [];
        continue;
      }

      // Check for end of code block
      if (inCodeBlock && line.trim() === '```') {
        if (currentExampleId) {
          references.push({
            file,
            line: codeBlockStart,
            exampleId: currentExampleId,
            codeSnippet: codeSnippet.join('\n').trim(),
            language: currentLanguage,
            queryFile: currentQueryFile,
          });
        }
        inCodeBlock = false;
        currentExampleId = null;
        currentLanguage = undefined;
        currentQueryFile = undefined;
        codeSnippet = [];
        continue;
      }

      // Collect code snippet lines
      if (inCodeBlock) {
        codeSnippet.push(line);
        continue;
      }

      // Single-sourced fences: a fumadocs `<include>` / `<includeregions>`
      // element carrying `playground example="<id>"` in its `meta`. These
      // replace a literal fence entirely; the body is injected from
      // schema.ts at compile time, so there is no in-MDX snippet to
      // containment-check. Capture the reference (so example existence is
      // still validated) and flag it so the snippet check skips it.
      //
      // TODO(single-source migration): once all fences are migrated, drop
      // the literal-fence snippet extraction above and replace this file's
      // containment test with a marker-integrity test that resolves every
      // `<include*>` region against its target file (the deterministic
      // check the design doc calls for).
      if (line.includes('<include') && line.includes('playground')) {
        const exampleMatch = line.match(/example=["']([^"']+)["']/);
        if (exampleMatch) {
          const langMatch = line.match(/lang=["']([^"']+)["']/);
          references.push({
            file,
            line: i + 1,
            exampleId: exampleMatch[1],
            codeSnippet: '',
            language: langMatch?.[1],
            isInclude: true,
          });
        }
      }
    }
  }

  return references;
}

/**
 * Get all available example IDs from the examples directory
 */
function getAvailableExamples(): Set<string> {
  try {
    const dirs = readdirSync(EXAMPLES_DIR, { withFileTypes: true });
    return new Set(dirs.filter((d) => d.isDirectory()).map((d) => d.name));
  } catch (_error) {
    return new Set();
  }
}

/**
 * Resolve whether a referenced example ID has a real bundle backing it.
 *
 * Bundles are either flat (e.g. `playground-examples/01-first-schema/`)
 * or multi-step (e.g. `playground-examples/errors-plugin/step-1/`). The
 * build script (scripts/build-playground-examples.ts) emits a per-step
 * JSON bundle at `<bundle-id>-step-<N>.json`, and the runtime loader
 * (components/playground/examples/index.ts) fetches bundles by exactly
 * that ID - so a doc reference to `<bundle-id>-step-<N>` is valid even
 * though no top-level directory exists with that literal name; it
 * resolves to the matching `step-<N>` subdirectory of the bundle. This
 * mirrors the resolution logic in scripts/check-playground-references.ts.
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
 * Read example schema file content. Examples with step subdirectories
 * (e.g. errors-plugin/step-1/schema.ts) don't carry a top-level
 * schema.ts, so we fall back to scanning step-* directories in order.
 */
function getExampleSchemaContent(exampleId: string): string {
  // A literal top-level directory always wins, so a flat example whose id
  // happens to end in `-variant-<slug>` or `-step-<N>` resolves to itself
  // (mirrors exampleReferenceExists and check-playground-references.ts).
  if (existsSync(join(EXAMPLES_DIR, exampleId, 'schema.ts'))) {
    return readFileSync(join(EXAMPLES_DIR, exampleId, 'schema.ts'), 'utf-8');
  }

  // Variant fences validate against their own variant-<slug>/schema.ts.
  const variantMatch = exampleId.match(/^(.+)-variant-([a-z0-9-]+)$/);
  if (variantMatch) {
    const [, base, slug] = variantMatch;
    try {
      return readFileSync(join(EXAMPLES_DIR, base, `variant-${slug}`, 'schema.ts'), 'utf-8');
    } catch {
      return '';
    }
  }

  // Step fences validate against their own step-<N>/schema.ts.
  const stepMatch = exampleId.match(/^(.+)-step-(\d+)$/);
  if (stepMatch) {
    const [, base, stepNumber] = stepMatch;
    try {
      return readFileSync(join(EXAMPLES_DIR, base, `step-${stepNumber}`, 'schema.ts'), 'utf-8');
    } catch {
      return '';
    }
  }

  try {
    const schemaPath = join(EXAMPLES_DIR, exampleId, 'schema.ts');
    return readFileSync(schemaPath, 'utf-8');
  } catch {
    // Stepped example: aggregate every step's schema.ts so a doc
    // snippet that lives in any step still validates.
    try {
      const entries = readdirSync(join(EXAMPLES_DIR, exampleId), { withFileTypes: true });
      const stepDirs = entries
        .filter((e) => e.isDirectory() && e.name.startsWith('step-'))
        .map((e) => e.name)
        .sort((a, b) => a.localeCompare(b));
      const parts: string[] = [];
      for (const dir of stepDirs) {
        try {
          parts.push(readFileSync(join(EXAMPLES_DIR, exampleId, dir, 'schema.ts'), 'utf-8'));
        } catch {
          /* ignore */
        }
      }
      return parts.join('\n');
    } catch {
      return '';
    }
  }
}

/**
 * Read example query file content. Like the schema reader above, this
 * falls back to step-* subdirectories for stepped examples.
 */
function getExampleQueryContent(exampleId: string, queryFile: string): string {
  try {
    const queryPath = join(EXAMPLES_DIR, exampleId, `${queryFile}.graphql`);
    return readFileSync(queryPath, 'utf-8');
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

/**
 * Normalize code for comparison (remove extra whitespace, comments)
 */
function normalizeCode(code: string): string {
  return (
    code
      // Remove single-line comments
      .replace(/\/\/.*$/gm, '')
      // Remove multi-line comments
      .replace(/\/\*[\s\S]*?\*\//g, '')
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      .trim()
  );
}

/**
 * Check if the example schema contains the code snippet
 */
function schemaContainsSnippet(schemaContent: string, snippet: string): boolean {
  const normalizedSchema = normalizeCode(schemaContent);
  const normalizedSnippet = normalizeCode(snippet);

  // For very short snippets (< 20 chars), require exact match
  if (normalizedSnippet.length < 20) {
    return normalizedSchema.includes(normalizedSnippet);
  }

  // For longer snippets, check if major code structures are present
  // Split into statements and check if most are present
  const snippetStatements = normalizedSnippet
    .split(/[;{}]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Ignore very short statements

  if (snippetStatements.length === 0) {
    return normalizedSchema.includes(normalizedSnippet);
  }

  // Check if at least 80% of statements are present
  const matchingStatements = snippetStatements.filter((stmt) => normalizedSchema.includes(stmt));

  return matchingStatements.length >= snippetStatements.length * 0.8;
}

describe('Playground Documentation Validation', () => {
  const references = extractPlaygroundReferences();
  const availableExamples = getAvailableExamples();

  it('should find playground references in documentation', () => {
    expect(references.length).toBeGreaterThan(0);
    console.log(`Found ${references.length} playground references in documentation`);
  });

  it('should have all referenced examples available', () => {
    const missingExamples = references.filter(
      (ref) => !exampleReferenceExists(ref.exampleId, availableExamples),
    );

    if (missingExamples.length > 0) {
      const details = missingExamples.map(
        (ref) => `  - ${ref.file}:${ref.line} references missing example "${ref.exampleId}"`,
      );
      throw new Error(
        `Found ${missingExamples.length} references to missing examples:\n${details.join('\n')}`,
      );
    }
  });

  it('should have example schemas that contain the referenced code snippets', () => {
    const failures: string[] = [];

    for (const ref of references) {
      // Base examples and definition-style variants are containment
      // checked against their resolved schema.ts. Step fences are only
      // existence-checked (a step's doc section often shows a curated
      // fragment that spans siblings), matching prior behaviour.
      // Single-sourced `<include>` fences have no hand-copied body to
      // check — the region markers in schema.ts are the source of truth.
      // Existence of `ref.exampleId` is still enforced by the
      // "referenced examples available" test above.
      // TODO(single-source migration): replace this whole containment test
      // with a marker-integrity test (resolve every included region against
      // its target file) once the full fence migration lands.
      if (ref.isInclude) {
        continue;
      }

      const isVariantRef = /-variant-[a-z0-9-]+$/.test(ref.exampleId);
      const isStepRef = /-step-\d+$/.test(ref.exampleId);
      if (isStepRef) {
        continue;
      }
      if (!isVariantRef && !availableExamples.has(ref.exampleId)) {
        continue; // Skip if example doesn't exist (covered by previous test)
      }
      if (isVariantRef && !exampleReferenceExists(ref.exampleId, availableExamples)) {
        continue;
      }

      // Determine if this is a GraphQL or TypeScript code block
      const isGraphQL = ref.language === 'graphql' || ref.language === 'gql';

      if (isGraphQL && ref.queryFile) {
        // Validate GraphQL code against query file
        const queryContent = getExampleQueryContent(ref.exampleId, ref.queryFile);
        if (!queryContent) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" has no ${ref.queryFile}.graphql file`,
          );
          continue;
        }

        if (!schemaContainsSnippet(queryContent, ref.codeSnippet)) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" query file "${ref.queryFile}.graphql" doesn't contain the referenced code snippet`,
          );
        }
      } else {
        // Validate TypeScript code against schema.ts
        const schemaContent = getExampleSchemaContent(ref.exampleId);
        if (!schemaContent) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" has no schema.ts file`,
          );
          continue;
        }

        if (!schemaContainsSnippet(schemaContent, ref.codeSnippet)) {
          failures.push(
            `  - ${ref.file}:${ref.line} example "${ref.exampleId}" schema doesn't contain the referenced code snippet`,
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

        // Check required fields
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
      // Strip leading /docs/ so we resolve under content/docs/
      const trimmed = docPath.replace(/^\/+/, '').replace(/^docs\//, '');
      const base = join(DOCS_DIR, trimmed);
      // Accept either a flat .mdx file or an index.mdx in a directory.
      try {
        readFileSync(`${base}.mdx`, 'utf-8');
        return true;
      } catch {
        // fall through
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
    // This test documents the current example structure
    const examplesByCategory: Record<string, string[]> = {};

    for (const exampleId of Array.from(availableExamples)) {
      const metadataPath = join(EXAMPLES_DIR, exampleId, 'metadata.json');
      try {
        const metadata = JSON.parse(readFileSync(metadataPath, 'utf-8'));
        const category = metadata.category || 'uncategorized';

        if (!examplesByCategory[category]) {
          examplesByCategory[category] = [];
        }
        examplesByCategory[category].push(exampleId);
      } catch {
        // Skip invalid metadata
      }
    }

    // Sort by order within each category
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

    // Verify we have core examples
    expect(examplesByCategory.core).toBeDefined();
    expect(examplesByCategory.core.length).toBeGreaterThan(0);
  });

  it.skip('should have valid GraphQL queries that work against their schemas', () => {
    // TODO: This test requires compiling TypeScript schemas in Node.js environment
    // The playground compiler uses esbuild-wasm which is browser-only
    // Schema compilation and type checking is already covered by other tests
    // Query validation happens at runtime in the playground
    expect(true).toBe(true);
  });
});
