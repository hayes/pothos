import SchemaBuilder from '@giraphql/core';
import { ContextType } from './backing-models';
import { User } from './data';
import AuthPlugin from '../../../src';

type Types = {
  Object: {
    User: User;
  };
  Scalar: {
    ID: { Input: string; Output: string | number };
  };
  Context: ContextType;
};

export default new SchemaBuilder<Types>({
  plugins: [new AuthPlugin()],
});
