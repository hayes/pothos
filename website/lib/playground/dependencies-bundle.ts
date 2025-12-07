/**
 * Static bundle of external dependencies for the playground.
 * Dependencies are loaded synchronously for use in user schema code.
 *
 * This provides a generic way to add any npm package to the playground
 * without modifying the execution engine.
 */

'use client';

import * as ZodModule from 'zod';

/**
 * Map of npm package names to their module exports.
 * Add new dependencies here to make them available in the playground.
 */
export const dependencyModules = {
  zod: ZodModule,
};

/**
 * Scans code for dependency imports and returns the required modules.
 * Supports both named and default imports from registered dependencies.
 *
 * @param code - User's schema code
 * @returns Map of dependency names to their module exports
 */
export function getDependencyModules(code: string): Record<string, unknown> {
  const modules: Record<string, unknown> = {};

  // Extract dependency imports from code
  // Matches: import ... from 'package-name'
  const importRegex = /import\s+.*?\s+from\s+['"]([^'"@][^'"]*)['"]/g;
  let match: RegExpExecArray | null = importRegex.exec(code);

  while (match !== null) {
    const packageName = match[1];
    const depModule = dependencyModules[packageName as keyof typeof dependencyModules];
    if (depModule) {
      modules[packageName] = depModule;
    }
    match = importRegex.exec(code);
  }

  return modules;
}
