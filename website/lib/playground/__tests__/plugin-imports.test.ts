import { describe, expect, it, vi } from 'vitest';

vi.mock('../pothos-types', () => ({
  coreTypeDefinitions: [],
  getAllPluginNames: () => [],
  getPluginTypeDefinitions: () => [],
}));

import { extractPluginImports } from '../setup-monaco';

describe('plugin type imports', () => {
  it('loads a plugin imported with a formatted default and named import', () => {
    expect([
      ...extractPluginImports(`
import ValidationPlugin, {
  createZodError,
} from '@pothos/plugin-validation';
`),
    ]).toEqual(['@pothos/plugin-validation']);
  });

  it('finds distinct default, namespace, and side-effect plugin imports', () => {
    expect([
      ...extractPluginImports(`
import SchemaBuilder from '@pothos/core';
import RelayPlugin from '@pothos/plugin-relay';
import * as Relay from '@pothos/plugin-relay';
import '@pothos/plugin-directives';
`),
    ]).toEqual(['@pothos/plugin-relay', '@pothos/plugin-directives']);
  });
});
