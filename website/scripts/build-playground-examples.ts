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

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

interface ExampleFile {
  filename: string;
  content: string;
  language?: 'typescript' | 'graphql';
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
  snippets?: CodeSnippet[];
  files: ExampleFile[];
  defaultQuery: string;
  queries?: Array<{ title?: string; query: string; variables?: string }>;
}

interface Step {
  id: string;
  title: string;
  description: string;
  order: number;
}

interface CodeSnippet {
  label: string;
  filename: string;
  startLine: number;
  endLine: number;
  description?: string;
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
  relatedDocs?: string[];
  prerequisites?: string[];
  steps?: Step[];
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
 * Build an example from a flat directory structure
 */
async function buildFlatExample(
  examplePath: string,
  metadata: ExampleMetadata,
): Promise<PlaygroundExample> {
  const files: ExampleFile[] = [];
  const queryFileInfo: Array<{ filename: string; content: string }> = [];

  const exampleFiles = await readdir(examplePath, { withFileTypes: true });

  for (const file of exampleFiles) {
    if (!file.isFile()) {
      continue;
    }

    const filename = file.name;

    // Skip metadata.json
    if (filename === 'metadata.json') {
      continue;
    }

    const filePath = join(examplePath, filename);
    const content = await readFile(filePath, 'utf-8');

    // Collect .ts files as code files
    if (filename.endsWith('.ts')) {
      files.push({
        filename,
        content,
        language: 'typescript',
      });
    }
    // Collect .graphql files as query files
    else if (filename.endsWith('.graphql')) {
      queryFileInfo.push({ filename, content });
    }
  }

  // Sort files to ensure schema.ts comes first if it exists
  files.sort((a, b) => {
    if (a.filename === 'schema.ts') {
      return -1;
    }
    if (b.filename === 'schema.ts') {
      return 1;
    }
    return a.filename.localeCompare(b.filename);
  });

  // Use first query file as default, or empty query
  const defaultQuery = queryFileInfo[0]?.content || '{\n  # Add your query here\n}';

  // Build queries array for multiple tabs
  const queries = queryFileInfo.map((fileInfo) => ({
    title: fileInfo.filename.replace(/\.(graphql|gql)$/, ''),
    query: fileInfo.content,
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
    snippets: metadata.snippets,
    files,
    defaultQuery,
    queries: queries.length > 0 ? queries : undefined,
  };
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
    });

    examples.push(stepExample);
  }

  return examples;
}

async function buildExamples() {
  console.log('[Build Examples] Starting...');

  // Read all example directories
  const entries = await readdir(EXAMPLES_SOURCE_DIR, { withFileTypes: true });
  const exampleDirs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name);

  console.log(`[Build Examples] Found ${exampleDirs.length} examples:`, exampleDirs);

  const examples: PlaygroundExample[] = [];

  for (const dirName of exampleDirs) {
    try {
      const examplePath = join(EXAMPLES_SOURCE_DIR, dirName);

      // Read metadata
      const metadataPath = join(examplePath, 'metadata.json');
      const metadataContent = await readFile(metadataPath, 'utf-8');
      const metadata: ExampleMetadata = JSON.parse(metadataContent);

      // Check if this example has step directories
      const hasSteps = await hasStepDirectories(examplePath);

      if (hasSteps) {
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
      console.error(`[Build Examples] ✗ Failed to build ${dirName}:`, err);
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
}

export interface CodeSnippet {
  label: string;
  filename: string;
  startLine: number;
  endLine: number;
  description?: string;
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

  await writeFile(INDEX_FILE, indexContent, 'utf-8');

  console.log(`[Build Examples] ✓ Built ${examples.length} examples`);
  console.log(`[Build Examples] ✓ Index: ${INDEX_FILE}`);
  console.log('[Build Examples] Done!');
}

// Run
buildExamples().catch((err) => {
  console.error('[Build Examples] Fatal error:', err);
  process.exit(1);
});
