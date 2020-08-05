/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import { GraphQLDirective } from 'graphql';
import { MergedScalars, SchemaTypes } from '..';
import { PluginConstructorMap } from '../..';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      plugins?: (keyof PluginConstructorMap<Types>)[];
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      directives?: readonly GraphQLDirective[];
      extensions?: Record<string, unknown>;
    }

    export interface Plugins<Types extends SchemaTypes> {}

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
