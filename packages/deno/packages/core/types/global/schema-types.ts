// @ts-nocheck
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-interface */
import type { GraphQLDirective } from 'https://cdn.skypack.dev/graphql?dts';
import type { PluginConstructorMap } from '../plugins.ts';
import type { MergedScalars, SchemaTypes, V3DefaultScalars } from '../schema-types.ts';
import type { IsStrictMode, RecursivelyNormalizeNullableFields } from '../utils.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface SchemaBuilderOptions<Types extends SchemaTypes> {
            plugins?: (keyof PluginConstructorMap<Types>)[];
            defaultFieldNullability: Types["Defaults"] extends "v3" ? false extends Types["DefaultFieldNullability"] ? never : Types["DefaultFieldNullability"] : true extends Types["DefaultFieldNullability"] ? never : Types["DefaultFieldNullability"];
            defaultInputFieldRequiredness: false extends Types["DefaultInputFieldRequiredness"] ? never : Types["DefaultInputFieldRequiredness"];
            notStrict: IsStrictMode extends true ? never : "Pothos may not work correctly when strict mode is not enabled in tsconfig.json";
            defaults: SchemaTypes["Defaults"] extends Types["Defaults"] ? never : Types["Defaults"];
        }
        export interface V3SchemaBuilderOptions<Types extends SchemaTypes> {
        }
        export interface V3DefaultSchemaTypes {
            Scalars: V3DefaultScalars;
        }
        export interface BuildSchemaOptions<Types extends SchemaTypes> {
            directives?: readonly GraphQLDirective[];
            extensions?: Record<string, unknown>;
            sortSchema?: boolean;
        }
        export interface Plugins<Types extends SchemaTypes> {
        }
        export interface PothosKindToGraphQLType {
            Object: "Object";
            Query: "Object";
            Mutation: "Object";
            Subscription: "Object";
            Interface: "Interface";
            Union: "Union";
            Enum: "Enum";
            Scalar: "Scalar";
            InputObject: "InputObject";
        }
        export interface UserSchemaTypes {
            Defaults: "v3" | "v4";
            Scalars: Record<string, {
                Input: unknown;
                Output: unknown;
            }>;
            Objects: {};
            Inputs: {};
            Interfaces: {};
            Root: object;
            Context: object;
            DefaultFieldNullability: boolean;
            DefaultInputFieldRequiredness: boolean;
        }
        export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> extends SchemaTypes {
            Defaults: PartialTypes["Defaults"] & SchemaTypes["Defaults"];
            Scalars: MergedScalars<PartialTypes>;
            Objects: PartialTypes["Objects"] & {};
            Inputs: PartialTypes["Inputs"] & {};
            Interfaces: PartialTypes["Interfaces"] & {};
            Root: PartialTypes["Root"] & {};
            Context: PartialTypes["Context"] & {};
            DefaultFieldNullability: PartialTypes["Defaults"] extends "v3" ? PartialTypes["DefaultFieldNullability"] extends true ? true : false : PartialTypes["DefaultFieldNullability"] extends false ? false : true;
            DefaultInputFieldRequiredness: PartialTypes["DefaultInputFieldRequiredness"] extends true ? true : false;
            outputShapes: {
                [K in keyof MergedScalars<PartialTypes>]: MergedScalars<PartialTypes>[K] extends {
                    Output: infer T;
                } ? T : never;
            } & {
                [K in keyof PartialTypes["Objects"]]: PartialTypes["Objects"][K];
            } & {
                [K in keyof PartialTypes["Interfaces"]]: PartialTypes["Interfaces"][K];
            };
            inputShapes: {
                [K in keyof MergedScalars<PartialTypes>]: MergedScalars<PartialTypes>[K] extends {
                    Input: infer T;
                } ? T : never;
            } & {
                [K in keyof PartialTypes["Inputs"]]: RecursivelyNormalizeNullableFields<PartialTypes["Inputs"][K]>;
            };
        }
    }
}
