/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  InterfaceType,
  FieldsShape,
  ObjectName,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface ObjectTypeOptions<
      Interfaces extends InterfaceType<
        {},
        Types,
        CompatibleInterfaceNames<Types, ShapeFromTypeParam<Types, Type, false>>
      >[],
      Types extends TypeInfo,
      Type extends ObjectName<Types>
    > {
      extends?: {
        [K in ObjectName<Types> | 'Query' | 'Mutation' | 'Suscription']?: FieldsShape<Types, K, {}>;
      };
    }
  }
}
