import { FieldNullability, InputFieldMap, SchemaTypes, TypeParam } from '@giraphql/core';
import { GiraphQLTestPlugin } from './plugin';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      test: GiraphQLTestPlugin<Types>;
    }
  }
}
