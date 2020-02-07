import SchemaBuilder, { ExtendDefaultScalars } from '@giraphql/core';
import { ContextType } from './backing-models';
import { User } from './data';
import AuthPlugin from '../../../src';

interface TypeInfo extends GiraphQLSchemaTypes.DefaultTypeInfo {
  Object: {
    User: User;
  };
  Scalar: ExtendDefaultScalars<{
    ID: { Input: string; Output: string | number };
  }>;
  Context: ContextType;
}

export default new SchemaBuilder<TypeInfo>({
  plugins: [new AuthPlugin()],
});
