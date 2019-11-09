import SchemaBuilder from 'schema-builder';
import { ContextType } from './backing-models';
import { User } from './data';
import AuthPlugin from '../../../src';

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
  plugins: [new AuthPlugin()],
});
