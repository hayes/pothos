import type { PlaygroundExample } from '../types';
import { basicTypesExample } from './basic-types';
import { enumsArgsExample } from './enums-args';
import { interfacesExample } from './interfaces';
import { mutationsExample } from './mutations';
import { relayPluginExample } from './relay-plugin';
import { simpleObjectsPluginExample } from './simple-objects-plugin';
import { unionsExample } from './unions';
import { withInputPluginExample } from './with-input-plugin';

export const examples: Record<string, PlaygroundExample> = {
  // Core examples
  'basic-types': basicTypesExample,
  mutations: mutationsExample,
  interfaces: interfacesExample,
  'enums-args': enumsArgsExample,
  unions: unionsExample,
  // Plugin examples
  'simple-objects-plugin': simpleObjectsPluginExample,
  'relay-plugin': relayPluginExample,
  'with-input-plugin': withInputPluginExample,
};

export function getExample(id: string): PlaygroundExample | undefined {
  return examples[id];
}

export const examplesList = Object.values(examples);

export {
  basicTypesExample,
  enumsArgsExample,
  interfacesExample,
  mutationsExample,
  relayPluginExample,
  simpleObjectsPluginExample,
  unionsExample,
  withInputPluginExample,
};
