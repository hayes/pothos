import {
  EmptyToOptional,
  FieldNullability,
  Normalize,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';

export interface ErrorsPluginOptions {
  defaultTypes?: (new (...args: any[]) => Error)[];
}

export type ErrorFieldOptions<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Shape,
  Nullable extends FieldNullability<Type>,
> = EmptyToOptional<{
  types?: (new (...args: any[]) => Error)[];
  union: Normalize<
    Omit<GiraphQLSchemaTypes.UnionTypeOptions<Types>, 'resolveType' | 'types'> & {
      name?: string;
    }
  >;
  result: Normalize<
    Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>, 'interfaces' | 'isTypeOf'> & {
      name?: string;
    }
  >;
  dataField: Normalize<
    Omit<
      GiraphQLSchemaTypes.ObjectFieldOptions<
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
      'args' | 'nullable' | 'resolve' | 'type'
    > & {
      name?: string;
    }
  >;
}>;
