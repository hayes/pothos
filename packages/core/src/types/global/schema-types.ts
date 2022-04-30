/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import { GraphQLDirective } from 'graphql';
import { PluginConstructorMap } from '../plugins';
import { MergedScalars, SchemaTypes } from '../schema-types';
import type { IsStrictMode } from '../utils';

declare global {
  export namespace PothosSchemaTypes {
    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      plugins?: (keyof PluginConstructorMap<Types>)[];
      defaultFieldNullability: false extends Types['DefaultFieldNullability']
        ? never
        : Types['DefaultFieldNullability'];
      defaultInputFieldRequiredness: false extends Types['DefaultInputFieldRequiredness']
        ? never
        : Types['DefaultInputFieldRequiredness'];
      notStrict: IsStrictMode extends true
        ? never
        : 'Pothos may not work correctly when strict mode is not enabled in tsconfig.json';
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      directives?: readonly GraphQLDirective[];
      extensions?: Record<string, unknown>;
    }

    export interface Plugins<Types extends SchemaTypes> {}

    export interface PothosKindToGraphQLType {
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

    export interface UserSchemaTypes {
      Scalars: Record<
        string,
        {
          Input: unknown;
          Output: unknown;
        }
      >;
      Objects: {};
      Interfaces: {};
      Root: object;
      Context: object;
      DefaultFieldNullability: boolean;
      DefaultInputFieldRequiredness: boolean;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>>
      extends SchemaTypes {
      Scalars: MergedScalars<PartialTypes>;
      Objects: PartialTypes['Objects'] & {};
      Interfaces: PartialTypes['Interfaces'] & {};
      Root: PartialTypes['Root'] & {};
      Context: PartialTypes['Context'] & {};
      DefaultFieldNullability: PartialTypes['DefaultFieldNullability'] extends true ? true : false;
      DefaultInputFieldRequiredness: PartialTypes['DefaultInputFieldRequiredness'] extends true
        ? true
        : false;
      outputShapes: {
        [K in keyof MergedScalars<PartialTypes>]: MergedScalars<PartialTypes>[K] extends {
          Output: infer T;
        }
          ? T
          : never;
      } & {
        [K in keyof PartialTypes['Objects']]: PartialTypes['Objects'][K];
      } & { [K in keyof PartialTypes['Interfaces']]: PartialTypes['Interfaces'][K] };
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
