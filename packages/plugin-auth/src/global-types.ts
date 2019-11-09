/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  CompatibleInterfaceNames,
  ShapeFromTypeParam,
  NamedTypeParam,
  TypeParam,
  InputFields,
  InterfaceType,
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
      permissions?: {
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
      Nullable extends boolean,
      Args extends InputFields<Types>
    > {
      gates?: string[];
    }
  }
}
