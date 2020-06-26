import SchemaBuilder from '@giraphql/core';
import '../../../src';

import { ContextType } from './types';
import { User } from './data';

type Types = {
  Objects: {
    User: User;
  };
  Context: ContextType;
};

const builder = new SchemaBuilder<Types>({
  plugins: ['GiraphQLExtends'],
});

export default builder;
