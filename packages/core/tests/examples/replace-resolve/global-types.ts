import type {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '../../../src';
import type { PothosResolve2Plugin } from './plugin';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      resolve2Plugin: PothosResolve2Plugin<Types>;
    }

    export interface InferredFieldOptions<
      Types extends SchemaTypes,
      ResolveShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveReturnShape = unknown,
    > {
      Resolve2: {
        /**
         * Resolver function for this field
         * @param parent - The parent object for the current type
         * @param {object} args - args object based on the args defined for this field
         * @param {object} context - the context object for the current query, based on `Context` type provided to the SchemaBuilder
         * @param {GraphQLResolveInfo} info - info about how this field was queried
         */
        resolve2: Resolver<
          ResolveShape,
          InputShapeFromFields<Args>,
          Types['Context'],
          ShapeFromTypeParam<Types, Type, Nullable>,
          ResolveReturnShape
        >;
      };
    }
  }
}
