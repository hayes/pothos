/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldsShape,
  ObjectName,
  RootName,
  RootFieldsShape,
  CompatibleInterfaceParam,
  ShapeFromType,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<
      Interfaces extends CompatibleInterfaceParam<Types, Shape>[],
      Types extends TypeInfo,
      Shape
    > {
      extends?: {
        [K in ObjectName<Types>]?: FieldsShape<Types, ShapeFromType<Types, K>>;
      } &
        { [K in RootName]?: RootFieldsShape<Types, K> };
    }
  }
}
