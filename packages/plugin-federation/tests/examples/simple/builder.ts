import SchemaBuilder from '@giraphql/core';
import DirectivesPlugin from '@giraphql/plugin-directives';
import FederationPlugin from '../../../src';
import { ContextType } from './types';

interface Types {
  Context: ContextType;
  Scalars: {
    ID: {
      Input: string;
      Output: number | string;
    };
  };
}

export default new SchemaBuilder<Types>({
  plugins: [DirectivesPlugin, FederationPlugin],
  useGraphQLToolsUnorderedDirectives: true,
});
