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
        /** When true, all non-null output fields get @semanticNonNull at level 0 */
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
      /**
       * Convert non-null positions to nullable with @semanticNonNull directive.
       * - `true`: applies to level 0 only (the field itself)
       * - `number[]`: applies to specific levels (e.g. [0, 1] for list + items)
       * - `false`: opt out when allNonNullFields is enabled
       */
      semanticNonNull?: boolean | number[];
    }
  }
}
