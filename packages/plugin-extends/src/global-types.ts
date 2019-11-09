/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  NamedTypeParam,
  InterfaceType,
  FieldsShape,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<
      Shape extends {},
      Interfaces extends InterfaceType<
        {},
        Types,
        CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, false>>
      >[],
      Types extends TypeInfo,
      Type extends NamedTypeParam<Types>
    > {
      extends?: {
        [K in keyof Types['Output']]?: FieldsShape<{ [s: string]: unknown }, Types, K, {}>;
      };
    }
  }
}
