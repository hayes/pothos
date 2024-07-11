/* eslint-disable unicorn/custom-error-definition */
import SchemaBuilder, {
  FieldNullability,
  InputFieldMap,
  InputShapeFromFields,
  ListResolveValue,
  MaybePromise,
  Resolver,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';

type ResolveShapeWithErrors<Shape, Errors> = [Shape] extends [
  readonly (infer Item)[] | null | undefined,
]
  ? ListResolveValue<Shape, Errors | Item, unknown>
  : MaybePromise<Errors | Shape>;

// Should match what you pass as default errors when setting up the builder
type DefaultErrors = CustomError1;

declare global {
  export namespace PothosSchemaTypes {
    export interface InferredFieldOptions<
      Types extends SchemaTypes,
      ResolveShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveReturnShape = unknown,
    > {
      ResolveWithErrors: {
        errors?: {
          types?: (new (...args: any[]) => ResolveReturnShape)[];
        };
        /**
         * Resolver function for this field
         * @param parent - The parent object for the current type
         * @param {object} args - args object based on the args defined for this field
         * @param {object} context - the context object for the current query, based on `Context` type provided to the SchemaBuilder
         * @param {GraphQLResolveInfo} info - info about how this field was queried
         */
        resolve: Resolver<
          ResolveShape,
          InputShapeFromFields<Args>,
          Types['Context'],
          ResolveShapeWithErrors<
            ShapeFromTypeParam<Types, Type, Nullable>,
            | DefaultErrors
            | (unknown extends ResolveReturnShape
                ? never
                : ResolveReturnShape extends infer T
                  ? T
                  : never)
          >
        >;
      };
    }
  }
}

class CustomError1 extends Error {
  prop1 = 'test';
}

class CustomError2 extends Error {
  prop2 = 'test';
}

const builder = new SchemaBuilder<{
  InferredFieldOptionsKind: 'ResolveWithErrors';
}>({
  errors: {
    defaultTypes: [Error],
  },
});

builder.queryType({
  fields: (t) => ({
    hello: t.string({
      errors: {
        types: [CustomError2],
      },
      resolve: () => {
        if (Math.random() < 0.2) {
          return new CustomError1('Random error');
        }

        if (Math.random() < 0.3) {
          return new CustomError2('Random error');
        }

        return 'Hello, world!';
      },
    }),
  }),
});

builder.subscriptionType({
  fields: (t) => ({
    hello: t.string({
      // eslint-disable-next-line @typescript-eslint/require-await
      async *subscribe() {
        yield 'Hello';
        yield 'World';
      },
      resolve: (message) => {
        if (Math.random() > 0.5) {
          return new CustomError1('Random error');
        }

        return message;
      },
    }),
  }),
});
