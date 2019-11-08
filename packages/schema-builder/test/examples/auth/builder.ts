import SchemaBuilder from '../../../src';
import { ContextType } from './backing-models';
import { User } from './data';

type Types = {
  Output: {
    String: string;
    User: User;
  };
  Input: {
    ID: string;
  };
};

export default new SchemaBuilder<Types, ContextType>();
