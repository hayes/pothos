import SchemaBuilder from '@giraphql/core';
import { ContextType } from './types';
import { User } from './data';
import ExtendsPlugin from '../../../src';

interface TypeInfo extends GiraphQLSchemaTypes.DefaultTypeInfo {
  Object: {
    User: User;
  };
  Context: ContextType;
}

export default new SchemaBuilder<TypeInfo>({
  plugins: [new ExtendsPlugin()],
});
