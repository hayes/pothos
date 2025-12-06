/**
 * Playground examples loader with dynamic imports
 *
 * Examples are stored as separate .ts/.graphql/.json files in
 * public/playground-examples/ and loaded on-demand to keep the initial
 * bundle size small.
 *
 * Each example is dynamically imported only when requested.
 */

import type { PlaygroundExample } from '../types';
import { exampleIds as generatedExampleIds } from './examples-index.generated';

// Re-export auto-generated example IDs and metadata
export { exampleIds, exampleMetadata, getExampleMetadata } from './examples-index.generated';
export type { ExampleMetadata } from './examples-index.generated';

// Cache for loaded examples
const examplesCache = new Map<string, PlaygroundExample>();

/**
 * Dynamically load an example by ID.
 * Examples are fetched on-demand and cached after first load.
 */
export async function getExample(id: string): Promise<PlaygroundExample | undefined> {
  // Return from cache if already loaded
  if (examplesCache.has(id)) {
    return examplesCache.get(id);
  }

  try {
    // Dynamically import the example JSON from the public directory
    const response = await fetch(`/playground-examples/${id}/metadata.json`);
    if (!response.ok) {
      console.error(`Failed to load example metadata: ${id}`);
      return undefined;
    }
    const metadata = await response.json();

    // Load schema file
    const schemaResponse = await fetch(`/playground-examples/${id}/schema.ts`);
    if (!schemaResponse.ok) {
      console.error(`Failed to load example schema: ${id}`);
      return undefined;
    }
    const schemaContent = await schemaResponse.text();

    // Load query file
    const queryResponse = await fetch(`/playground-examples/${id}/query.graphql`);
    if (!queryResponse.ok) {
      console.error(`Failed to load example query: ${id}`);
      return undefined;
    }
    const queryContent = await queryResponse.text();

    // Construct the example object
    const example: PlaygroundExample = {
      id: metadata.id,
      title: metadata.title,
      description: metadata.description,
      files: [
        {
          filename: 'schema.ts',
          content: schemaContent,
          language: 'typescript',
        },
      ],
      defaultQuery: queryContent,
    };

    // Cache and return
    examplesCache.set(id, example);
    return example;
  } catch (error) {
    console.error(`Error loading example ${id}:`, error);
    return undefined;
  }
}

/**
 * Preload an example to warm the cache.
 * Useful for prefetching examples that are likely to be used.
 */
export function preloadExample(id: string): void {
  // Fire and forget - don't await
  getExample(id).catch((err) => console.error(`Failed to preload example ${id}:`, err));
}

/**
 * Get all example IDs as an array
 */
export function getExampleIds(): readonly string[] {
  return generatedExampleIds;
}
