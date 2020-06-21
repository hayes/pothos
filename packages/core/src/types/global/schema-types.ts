/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import { MergedScalars, SchemaTypes } from '..';

import './type-options';
import './field-options';
import './plugins';
import './classes';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilderOptions {}

    export interface GiraphQLKindToGraphQLType {
      Object: 'Object';
      Query: 'Object';
      Mutation: 'Object';
      Subscription: 'Object';
      Interface: 'Interface';
      Union: 'Union';
      Enum: 'Enum';
      Scalar: 'Scalar';
      InputObject: 'InputObject';
    }

    export interface TypeInfo {
      Scalars: {
        [s: string]: {
          Input: unknown;
          Output: unknown;
        };
      };
      Objects: {};
      Interfaces: {};
      Root: object;
      Context: object;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<GiraphQLSchemaTypes.TypeInfo>>
      extends SchemaTypes {
      Scalars: MergedScalars<PartialTypes>;
      Objects: PartialTypes['Objects'] & {};
      Interfaces: PartialTypes['Interfaces'] & {};
      Root: PartialTypes['Root'] & {};
      Context: PartialTypes['Context'] & {};
      outputShapes: { [K in keyof PartialTypes['Objects']]: PartialTypes['Objects'][K] } &
        { [K in keyof PartialTypes['Interfaces']]: PartialTypes['Interfaces'][K] } &
        {
          [K in keyof MergedScalars<PartialTypes>]: MergedScalars<PartialTypes>[K] extends {
            Output: infer T;
          }
            ? T
            : never;
        };
      inputShapes: {
        [K in keyof MergedScalars<PartialTypes>]: MergedScalars<PartialTypes>[K] extends {
          Input: infer T;
        }
          ? T
          : never;
      };
    }
  }
}
