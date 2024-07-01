import SchemaBuilder from '@pothos/core';
import ErrorsPlugin from '@pothos/plugin-errors';
import RelayPlugin from '@pothos/plugin-relay';
import WithInputPlugin from '@pothos/plugin-with-input';
import SubGraphPlugin from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
  SubGraphs: 'Private' | 'Public';
  Defaults: 'v3';
}

export default new SchemaBuilder<Types>({
  defaults: 'v3',
  plugins: [ErrorsPlugin, SubGraphPlugin, RelayPlugin, WithInputPlugin],
  subGraphs: {
    fieldsInheritFromTypes: true,
    defaultForTypes: ['Private'],
  },
  errorOptions: {
    defaultTypes: [],
    defaultUnionOptions: {
      subGraphs: ['Private', 'Public'],
    },
    defaultResultOptions: {
      subGraphs: ['Private', 'Public'],
      defaultSubGraphsForFields: ['Private', 'Public'],
    },
  },
  relayOptions: {
    clientMutationId: 'omit',
    cursorType: 'String',
    defaultConnectionTypeOptions: {
      subGraphs: ['Private', 'Public'],
      defaultSubGraphsForFields: ['Private', 'Public'],
    },
    defaultEdgeTypeOptions: {
      subGraphs: ['Private', 'Public'],
      defaultSubGraphsForFields: ['Private', 'Public'],
    },
    pageInfoTypeOptions: {
      subGraphs: ['Private', 'Public'],
      defaultSubGraphsForFields: ['Private', 'Public'],
    },
    defaultPayloadTypeOptions: {
      subGraphs: ['Private', 'Public'],
      defaultSubGraphsForFields: ['Private', 'Public'],
    },
    defaultMutationInputTypeOptions: {
      subGraphs: ['Private', 'Public'],
    },
  },
  withInput: {
    typeOptions: { subGraphs: ['Private', 'Public'] },
  },
});
