import { FieldNullability, SchemaTypes, TypeParam } from '@giraphql/core';

export interface ErrorsPluginOptions {
  defaultTypes?: (new (...args: any[]) => Error)[];
}

export interface ErrorFieldOptions<
  Types extends SchemaTypes,
  Type extends TypeParam<Types>,
  Shape,
  Nullable extends FieldNullability<Type>,
> {
  types?: (new (...args: any[]) => Error)[];
  union?: Omit<GiraphQLSchemaTypes.UnionTypeOptions<Types>, 'resolveType' | 'types'> & {
    name?: string;
  };
  result?: Omit<GiraphQLSchemaTypes.ObjectTypeOptions<Types, Shape>, 'interfaces' | 'isTypeOf'> & {
    name?: string;
  };
  dataField?: GiraphQLSchemaTypes.ObjectFieldOptions<
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
  > & {
    name?: string;
  };
}
