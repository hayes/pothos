import SchemaBuilder from '@pothos/core';
import Mocks from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

export interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
}

export const builder = new SchemaBuilder<Types>({
  plugins: [Mocks],
});
