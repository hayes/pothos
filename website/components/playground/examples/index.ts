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

export type { CodeSnippet, ExampleMetadata, Step } from './examples-index.generated';
// Re-export auto-generated example IDs and metadata
export {
  exampleIds,
  exampleMetadata,
  getExampleMetadata,
  getExamplesByCategory,
  getExamplesBySubcategory,
  getOrganizedExamples,
} from './examples-index.generated';

// Cache for loaded examples
const examplesCache = new Map<string, PlaygroundExample>();

/**
 * Lightweight synchronous list of examples (metadata only, no code).
 * Use this for listing examples in the UI.
 * Use getExample() to load the full example with code on-demand.
 */
export { exampleMetadata as examples } from './examples-index.generated';

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
    // Load the pre-built JSON bundle for this example
    const response = await fetch(`/playground-examples/${id}.json`);
    if (!response.ok) {
      console.error(`Failed to load example bundle: ${id}`);
      return undefined;
    }
    const example: PlaygroundExample = await response.json();

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
