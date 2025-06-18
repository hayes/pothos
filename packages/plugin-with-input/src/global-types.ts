import type {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import type { PothosWithInputPlugin } from '.';
import type {
  FieldWithInputOptions,
  WithInputArgOptions,
  WithInputBuilderOptions,
  WithInputTypeOptions,
} from './types';

declare global {
  export namespace PothosSchemaTypes {
    export interface UserSchemaTypes {
      WithInputArgRequired: boolean;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      WithInputArgRequired: boolean extends PartialTypes['WithInputArgRequired']
        ? true
        : PartialTypes['WithInputArgRequired'] & boolean;
    }
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
        Fields extends InputFieldMap,
        Type extends TypeParam<Types>,
        ResolveShape,
        ResolveReturnShape,
        ArgRequired extends boolean,
        Args extends InputFieldMap = {},
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
          ResolveReturnShape,
          boolean extends ArgRequired ? Types['WithInputArgRequired'] & boolean : ArgRequired
        >,
      ) => FieldRef<Types, ShapeFromTypeParam<Types, Type, Nullable>>;
    }

    export interface FieldWithInputBaseOptions<
      Types extends SchemaTypes,
      Args extends InputFieldMap,
      Fields extends InputFieldMap,
      InputName extends string,
      ArgRequired extends boolean,
    > {
      typeOptions?: WithInputTypeOptions<Types, Fields>;
      argOptions?: WithInputArgOptions<Types, Fields, InputName, ArgRequired>;
      input: Fields;
      args?: Args;
    }
  }
}
