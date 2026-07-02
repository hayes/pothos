/**
 * Static bundle of browser-compatible Pothos plugins for the playground.
 * Plugins are loaded synchronously to avoid async import issues.
 *
 * Note: Plugins register themselves with SchemaBuilder as a side effect
 * when imported. The default export is typically just the plugin name string.
 */

'use client';

import * as AddGraphQLModule from '@pothos/plugin-add-graphql';
import * as ComplexityModule from '@pothos/plugin-complexity';
// plugin-dataloader pulls in the `dataloader` npm package. Because the
// plugin is imported statically here, its `dataloader` dependency is
// bundled together with the single workspace @pothos/core instance —
// nothing round-trips through esm.sh, so `instanceof` checks against
// Pothos refs keep working.
import * as DataloaderModule from '@pothos/plugin-dataloader';
import * as DirectivesModule from '@pothos/plugin-directives';
import * as ErrorsModule from '@pothos/plugin-errors';
import * as MocksModule from '@pothos/plugin-mocks';
import * as RelayModule from '@pothos/plugin-relay';
import * as ScopeAuthModule from '@pothos/plugin-scope-auth';
// Import the full plugin modules (includes default export and all named exports)
import * as SimpleObjectsModule from '@pothos/plugin-simple-objects';
import * as SubGraphModule from '@pothos/plugin-sub-graph';
import * as ValidationModule from '@pothos/plugin-validation';
import * as WithInputModule from '@pothos/plugin-with-input';

export const pluginModules = {
  '@pothos/plugin-simple-objects': SimpleObjectsModule,
  '@pothos/plugin-relay': RelayModule,
  '@pothos/plugin-with-input': WithInputModule,
  '@pothos/plugin-scope-auth': ScopeAuthModule,
  '@pothos/plugin-errors': ErrorsModule,
  '@pothos/plugin-validation': ValidationModule,
  '@pothos/plugin-directives': DirectivesModule,
  '@pothos/plugin-dataloader': DataloaderModule,
  '@pothos/plugin-complexity': ComplexityModule,
  '@pothos/plugin-mocks': MocksModule,
  '@pothos/plugin-sub-graph': SubGraphModule,
  '@pothos/plugin-add-graphql': AddGraphQLModule,
};

export function getPluginModules(code: string): Record<string, unknown> {
  const modules: Record<string, unknown> = {};

  // Extract plugin imports from code. `[\s\S]*?` so multi-line imports
  // (named bindings split across lines) match too.
  const importRegex = /import\s+[\s\S]*?\s+from\s+['"](@pothos\/plugin-[^'"]+)['"]/g;
  let match: RegExpExecArray | null = importRegex.exec(code);

  while (match !== null) {
    const pluginName = match[1];
    const pluginModule = pluginModules[pluginName as keyof typeof pluginModules];
    if (pluginModule) {
      modules[pluginName] = pluginModule;
    }
    match = importRegex.exec(code);
  }

  return modules;
}
