import type {
  EmptyToOptional,
  FieldNullability,
  InferredFieldOptionKeys,
  Normalize,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';

export type GetTypeName = (options: { parentTypeName: string; fieldName: string }) => string;

export interface ErrorsPluginOptions<Types extends SchemaTypes> {
  defaultTypes?: (new (
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    ...args: any[]
  ) => Error)[];
  directResult?: boolean;
  defaultUnionOptions?: Normalize<
    Omit<PothosSchemaTypes.UnionTypeOptions<Types>, 'resolveType' | 'types'> & {
      name?: GetTypeName;
    }
  >;
  defaultResultOptions?: Normalize<
    Omit<PothosSchemaTypes.ObjectTypeOptions<Types, {}>, 'interfaces' | 'isTypeOf'> & {
      name?: GetTypeName;
    }
  >;
  defaultItemResultOptions?: Normalize<
    Omit<PothosSchemaTypes.ObjectTypeOptions<Types, {}>, 'interfaces' | 'isTypeOf'> & {
      name?: GetTypeName;
    }
  >;
  defaultItemUnionOptions?: Normalize<
    Omit<PothosSchemaTypes.UnionTypeOptions<Types>, 'resolveType' | 'types'> & {
      name?: GetTypeName;
    }
  >;
  /**
   * Callback for logging any errors which are handled by the errors plugin, this
   * function will not be called for errors that are not handled by the errors plugin
   **/
  onResolvedError?: (error: Error) => void;
  /**
   * Errors thrown during custom argument validation or mapping will be processed like errors thrown in resolvers
   * This will enables catching errors thrown by the validation plugin.
   *
   * This settings may have security implications because auth checks for a field will not be applied when handling input errors
   */
  unsafelyHandleInputErrors?: boolean;
}

export type ErrorFieldOptions<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Shape,
  Nullable extends FieldNullability<Type>,
> = EmptyToOptional<{
  types?: (new (
    // biome-ignore lint/suspicious/noExplicitAny: this is fine
    ...args: any[]
  ) => Error)[];
  directResult?: Type extends unknown[] ? false : boolean;
  union: Normalize<
    Omit<PothosSchemaTypes.UnionTypeOptions<Types>, 'resolveType' | 'types'> & {
      name?: string;
    }
  >;
  result: Normalize<
    Omit<PothosSchemaTypes.ObjectTypeOptions<Types, Shape>, 'interfaces' | 'isTypeOf'> & {
      name?: string;
    }
  >;
  dataField: Normalize<
    Omit<
      PothosSchemaTypes.ObjectFieldOptions<
        Types,
        Shape,
        Type,
        Type extends [unknown]
          ? {
              list: false;
              items: Nullable extends { items: boolean } ? Nullable['items'] : true;
            }
          : false,
        {},
        Shape
      >,
      'args' | 'nullable' | 'type' | InferredFieldOptionKeys
    > & {
      name?: string;
    }
  >;
}>;
