import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldRef,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import { FieldWithInputOptions, WithInputBuilderOptions } from './types';
import { PothosWithInputPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      withInput: PothosWithInputPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      withInput?: WithInputBuilderOptions<Types>;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      input: InputFieldBuilder<Types, 'InputObject'>;
      fieldWithInput: <
        Fields extends Record<string, InputFieldRef<unknown, 'InputObject'>>,
        Type extends TypeParam<Types>,
        ResolveShape,
        ResolveReturnShape,
        Args extends Record<string, InputFieldRef<unknown, 'Arg'>> = {},
        Nullable extends FieldNullability<Type> = Types['DefaultFieldNullability'],
        InputName extends string = 'input',
      >(
        options: FieldWithInputOptions<
          Types,
          ParentShape,
          Kind,
          Args,
          Fields,
          Type,
          Nullable,
          InputName,
          ResolveShape,
          ResolveReturnShape
        >,
      ) => FieldRef<ShapeFromTypeParam<Types, Type, Nullable>>;
    }
  }
}
