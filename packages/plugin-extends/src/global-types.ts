/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldsShape,
  ObjectName,
  RootName,
  RootFieldsShape,
  CompatibleInterfaceParam,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<
      Interfaces extends CompatibleInterfaceParam<Types, Shape>[],
      Types extends TypeInfo,
      Shape
    > {
      extends?: {
        [K in ObjectName<Types>]?: FieldsShape<Types, K>;
      } &
        { [K in RootName]?: RootFieldsShape<Types, K> };
    }
  }
}
