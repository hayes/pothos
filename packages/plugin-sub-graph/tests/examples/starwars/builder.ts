import SchemaBuilder from '@giraphql/core';
import SubGraphPlugin from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
  SubGraphs: 'Private' | 'Public';
}

export default new SchemaBuilder<Types>({
  plugins: [SubGraphPlugin],
  subGraphs: {
    fieldsInheritFromTypes: true,
    defaultForTypes: ['Private'],
  },
});
