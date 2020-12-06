/* eslint-disable @typescript-eslint/no-unused-vars */
import { TypeParam, InputFieldMap, FieldNullability, SchemaTypes } from '@giraphql/core';
import z from 'zod';
import ZodPlugin from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      GiraphQLZod: ZodPlugin<Types>;
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
  }
}
