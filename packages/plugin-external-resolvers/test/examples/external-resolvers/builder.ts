import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import { User } from './data';
import ExternalResolverPlugin from '../../../src';

type Types = {
  Output: {
    String: string;
    User: User;
  };
  Input: {
    ID: string;
  };
  Context: ContextType;
};

export default new SchemaBuilder<Types>({
  plugins: [new ExternalResolverPlugin()],
});
