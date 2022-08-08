import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import SubGraphPlugin from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
  SubGraphs: 'Private' | 'Public';
}

export default new SchemaBuilder<Types>({
  plugins: [ErrorsPlugin, SubGraphPlugin, RelayPlugin],
  errorOptions: {
    defaultTypes: [],
  },
  relayOptions: {
    clientMutationId: 'omit',
    cursorType: 'String',
  },
  subGraphs: {
    fieldsInheritFromTypes: true,
    defaultForTypes: ['Private'],
  },
});
