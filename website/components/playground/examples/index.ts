import type { PlaygroundExample } from '../types';
import { basicTypesExample } from './basic-types';
import { enumsArgsExample } from './enums-args';
import { interfacesExample } from './interfaces';
import { mutationsExample } from './mutations';
import { unionsExample } from './unions';

export const examples: Record<string, PlaygroundExample> = {
  'basic-types': basicTypesExample,
  mutations: mutationsExample,
  interfaces: interfacesExample,
  'enums-args': enumsArgsExample,
  unions: unionsExample,
};

export function getExample(id: string): PlaygroundExample | undefined {
  return examples[id];
}

export const examplesList = Object.values(examples);

export { basicTypesExample, enumsArgsExample, interfacesExample, mutationsExample, unionsExample };
