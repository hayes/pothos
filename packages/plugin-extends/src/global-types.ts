/* eslint-disable @typescript-eslint/no-unused-vars */
import { FieldsShape, ObjectName, RootName, RootFieldsShape } from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<Types extends TypeInfo, Shape> {
      extends?: {
        [K in ObjectName<Types>]?: FieldsShape<Types, Types['Object'][K]>;
      } &
        { [K in RootName]?: RootFieldsShape<Types, K> };
    }
  }
}
