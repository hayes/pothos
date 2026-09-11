import type {
  FieldNullability,
  InputFieldMap,
  ObjectRef,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import type { HooksPlugin } from './plugin';

declare global {
  namespace PothosSchemaTypes {
    interface Plugins<Types extends SchemaTypes> {
      architectureHooks: HooksPlugin<Types>;
    }
    interface SchemaBuilderOptions<Types extends SchemaTypes> {
      optionInRootOfConfig?: boolean;
      nestedOptionsObject?: { exampleOption: string };
    }
    interface BuildSchemaOptions<Types extends SchemaTypes> {
      customBuildTimeOptions?: boolean;
    }
    interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      optionOnObject?: boolean;
    }
    interface MutationFieldOptions<
      Types extends SchemaTypes,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveReturnShape,
    > {
      customMutationFieldOption?: boolean;
    }
    interface SchemaBuilder<Types extends SchemaTypes> {
      buildCustomObject: () => ObjectRef<Types, { custom: 'shape' }>;
    }
  }
}
