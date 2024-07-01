/* eslint-disable @typescript-eslint/no-unused-vars */
import type { FieldNullability, InputFieldMap, SchemaTypes, TypeParam } from '../../../src';
import type { PothosTestPlugin } from './plugin';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      test: PothosTestPlugin<Types>;
    }

    export interface InterfaceFieldOptions<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {
      exampleRequiredOptionFromPlugin: boolean;
    }
  }
}
