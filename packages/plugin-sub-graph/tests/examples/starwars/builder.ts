import SchemaBuilder from '@giraphql/core';
import '../../../src';

import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
  SubGraphs: 'Public' | 'Private';
}

export default new SchemaBuilder<Types>({
  plugins: ['GiraphQLSubGraph'],
  subGraphs: {
    fieldsInheritFromTypes: true,
    defaultForTypes: ['Private'],
  },
});
