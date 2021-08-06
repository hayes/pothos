/* eslint-disable @typescript-eslint/no-unused-vars */
import { FieldNullability, InputFieldMap, SchemaTypes, TypeParam } from '@giraphql/core';
import { GiraphQLExamplePlugin } from './index.js';
import { ExamplePluginOptions } from './types.js';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      example: GiraphQLExamplePlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      optionInRootOfConfig?: boolean;
      nestedOptionsObject?: ExamplePluginOptions;
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      customBuildTimeOptions?: boolean;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      optionOnObject?: boolean;
    }

    export interface MutationFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {
      customMutationFieldOption?: boolean;
    }
  }
}
