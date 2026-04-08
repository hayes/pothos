import type {
  FieldNullability,
  InputFieldMap,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import type { PothosSemanticNullabilityPlugin } from '.';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      semanticNullability: PothosSemanticNullabilityPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      semanticNullability?: {
        /** When true, all non-null output fields are converted to nullable with @semanticNonNull */
        allNonNullFields?: boolean;
      };
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {
      semanticNonNull?: boolean;
    }
  }
}
