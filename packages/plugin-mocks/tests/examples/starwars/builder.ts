import SchemaBuilder from '@giraphql/core';
import Mocks from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
}

export default new SchemaBuilder<Types>({
  plugins: [Mocks],
});
