/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  TypeParam,
  InputFields,
  InterfaceType,
  ObjectName,
  FieldNullability,
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
      Type extends ObjectName<Types>
    > {
      authChecks?: {
        [s: string]: (
          parent: ShapeFromTypeParam<Types, Type, false>,
          context: Types['Context'],
        ) => boolean;
      };
    }

    export interface FieldOptions<
      Types extends TypeInfo,
      ParentName extends TypeParam<Types>,
      ReturnTypeName extends TypeParam<Types>,
      Nullable extends FieldNullability<Types, ReturnTypeName>,
      Args extends InputFields<Types>
    > {
      authWith?: string[];
      grantAuth?: {
        [s: string]:
          | true
          | ((
              parent: ShapeFromTypeParam<Types, ReturnTypeName, false>,
              context: Types['Context'],
            ) => boolean);
      };
    }
  }
}
