import '../../../src';
import SchemaBuilder from '@giraphql/core';
import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
  SubGraphs: 'Private' | 'Public';
}

export default new SchemaBuilder<Types>({
  plugins: ['GiraphQLSubGraph'],
  subGraphs: {
    fieldsInheritFromTypes: true,
    defaultForTypes: ['Private'],
  },
});
