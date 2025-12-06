/**
 * Playground examples loader
 *
 * Examples are now stored as separate .ts/.graphql/.json files in
 * public/playground-examples/ and bundled into a JSON file at build time.
 *
 * This provides better maintainability, easier editing, and smaller bundles.
 */

import type { PlaygroundExample } from '../types';

// Import the bundled examples JSON
// This is generated at build time by scripts/build-playground-examples.ts
import examplesData from '../../../public/playground-examples.json';

// Type the imported JSON data
const typedExamples = examplesData as PlaygroundExample[];

// Create a map for efficient lookup
export const examples: Record<string, PlaygroundExample> = {};
for (const example of typedExamples) {
  examples[example.id] = example;
}

/**
 * Get a specific example by ID
 */
export function getExample(id: string): PlaygroundExample | undefined {
  return examples[id];
}

/**
 * Get all examples as an array
 */
export const examplesList = typedExamples;

/**
 * Get all example IDs
 */
export const exampleIds = typedExamples.map((ex) => ex.id);
