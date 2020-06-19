/* eslint-disable @typescript-eslint/no-unused-vars */
import { MergedScalars, SchemaTypes } from '..';

import './type-options';
import './field-options';
import './plugins';
import './classes';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface TypeInfo {
      Scalar: {
        [s: string]: {
          Input: unknown;
          Output: unknown;
        };
        String: {
          Input: unknown;
          Output: unknown;
        };
        ID: {
          Input: unknown;
          Output: unknown;
        };
        Int: {
          Input: unknown;
          Output: unknown;
        };
        Float: {
          Input: unknown;
          Output: unknown;
        };
        Boolean: {
          Input: unknown;
          Output: unknown;
        };
      };
      Object: {};
      Root: {};
      Interface: {};
      Context: object;
    }

    export interface PartialTypeInfo {
      Scalar?: {
        [s: string]: {
          Input: unknown;
          Output: unknown;
        };
      };
      Object?: {};
      Interface?: {};
      Root?: {};
      Context?: {};
    }

    export interface MergedTypeMap<Partial extends GiraphQLSchemaTypes.PartialTypeInfo>
      extends SchemaTypes {
      Scalar: Partial['Scalar'] & MergedScalars<Partial['Scalar'] & {}>;
      Object: Partial['Object'] & {};
      Interface: Partial['Interface'] & {};
      Root: Partial['Root'] & {};
      Context: Partial['Context'] & {};
    }
  }
}
