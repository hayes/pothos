/* eslint-disable @typescript-eslint/no-unused-vars */
import { FieldNullability, InputFieldMap, SchemaTypes, TypeParam } from '@pothos/core';
import { EdgeDBPluginOptions } from './types';

import type { PothosEdgeDBPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      edgedb: PothosEdgeDBPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      optionInRootOfConfig?: boolean;
      nestedOptionsObject?: EdgeDBPluginOptions;
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
