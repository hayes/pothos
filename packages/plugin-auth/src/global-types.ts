/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ShapeFromTypeParam,
  TypeParam,
  InputFields,
  FieldNullability,
  RootName,
  CompatibleInterfaceParam,
} from '@giraphql/core';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface RootTypeOptions<Types extends TypeInfo, Type extends RootName> {
      authChecks?: {
        [s: string]: (
          parent: ShapeFromTypeParam<Types, Type, false>,
          context: Types['Context'],
        ) => boolean;
      };
    }

    export interface ObjectTypeOptions<
      Interfaces extends CompatibleInterfaceParam<Types, Shape>[],
      Types extends TypeInfo,
      Shape
    > {
      authChecks?: {
        [s: string]: (parent: Shape, context: Types['Context']) => boolean;
      };
    }

    export interface FieldOptions<
      Types extends TypeInfo,
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
