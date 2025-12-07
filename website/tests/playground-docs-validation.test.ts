import { readdirSync, readFileSync } from 'node:fs';
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
 * Read example schema file content
 */
function getExampleSchemaContent(exampleId: string): string {
  try {
    const schemaPath = join(EXAMPLES_DIR, exampleId, 'schema.ts');
    return readFileSync(schemaPath, 'utf-8');
  } catch {
    return '';
  }
}

/**
 * Read example query file content
 */
function getExampleQueryContent(exampleId: string, queryFile: string): string {
  try {
    const queryPath = join(EXAMPLES_DIR, exampleId, `${queryFile}.graphql`);
    return readFileSync(queryPath, 'utf-8');
  } catch {
    return '';
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
    const missingExamples = references.filter((ref) => !availableExamples.has(ref.exampleId));

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
      if (!availableExamples.has(ref.exampleId)) {
        continue; // Skip if example doesn't exist (covered by previous test)
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
