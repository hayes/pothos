/* eslint-disable @typescript-eslint/no-unused-vars */
import { toZod } from 'tozod';
import z from 'zod';
import {
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputObjectRef,
  InputRef,
  InputShapeFromTypeParam,
  InputType,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { GiraphQLZodPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      zod: GiraphQLZodPlugin<Types>;
    }

    export interface FieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape
    > {
      zodSchema?: z.Schema<unknown>;
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>
    > {
      zod?: (
        z: ZodFromType<Types, Type, InputShapeFromTypeParam<Types, Type, true>>,
      ) => ZodFromType<Types, Type, InputShapeFromTypeParam<Types, Type, true>>;
      validate?: ValidateFromType<Types, Type, InputShapeFromTypeParam<Types, Type, true>>;
    }

    export type ZodFromType<
      Types extends SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>],
      Shape
    > = ExtractType<ZodTypes<Shape>[keyof ZodTypes<Shape>], Type>;

    export type ValidateFromType<
      Types extends SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>],
      Shape
    > = ExtractType<ValidateTypes<Shape>[keyof ValidateTypes<Shape>], Type>;

    export type ExtractType<Types, Type> = Types extends [infer T, infer Zod]
      ? Type extends T
        ? Zod
        : never
      : never;

    export interface ZodTypes<Shape> {
      String: [InputRef<string> | 'String', z.ZodString];
      ID: ['ID', z.ZodUnion<[z.ZodString, z.ZodNumber]>];
      Int: ['Int', z.ZodNumber];
      Float: [InputRef<number> | 'Float', z.ZodNumber];
      Boolean: [InputRef<boolean> | 'Boolean', z.ZodBoolean];
      InputObject: [InputObjectRef<Shape>, toZod<Shape>];
    }

    export interface ValidateTypes<Shape> {
      String: [
        InputRef<string> | 'String',
        {
          max?: number | { value: number; message: string };
          min?: number | { value: number; message: string };
          email?: boolean | string;
          refine?: {
            check: (value: Shape) => boolean;
            message?: string;
            path?: (number | string)[];
          };
        },
      ];
      Int: [
        'Int',
        {
          max?: number | { value: number; message: string };
          min?: number | { value: number; message: string };
          refine?: {
            check: (value: Shape) => boolean;
            message?: string;
            path?: (number | string)[];
          };
        },
      ];
      InputObject: [
        InputObjectRef<Shape>,
        {
          refine?: {
            check: (value: Shape) => boolean;
            message?: string;
            path?: (number | string)[];
          };
        },
      ];
    }
  }
}
