import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import { User } from './data';
import ExtendsPlugin from '../../../src';

type Types = {
  Object: {
    User: User;
  };
  Context: ContextType;
};

export default new SchemaBuilder<Types>({
  plugins: [new ExtendsPlugin()],
});
