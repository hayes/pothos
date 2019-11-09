import { TypeParam, InputFields, CompatibleTypes, NamedTypeParam } from '../types';
import Field from '../field';

export default class BaseFieldUtil<
  Types extends SpiderSchemaTypes.TypeInfo,
  ParentType extends TypeParam<Types>
> {
  typename: NamedTypeParam<Types>;

  constructor(name: NamedTypeParam<Types>) {
    this.typename = name;
  }

  protected createField<
    Args extends InputFields<Types>,
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Extends extends string | null
  >(
    options: SpiderSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, Args>,
    extendsField: Extends,
  ) {
    return new Field<Args, Types, ParentType, Type, Nullable, Extends>(
      {
        ...options,
        extendsField,
      },
      this.typename,
    );
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Nullable extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Nullable>,
    Extends extends string | null
  >(
    name: Name,
    options: Omit<SpiderSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, {}>, 'resolve'>,
    extendsField: Extends,
  ) {
    return new Field<{}, Types, ParentType, Type, Nullable, Extends>(
      {
        ...options,
        // @ts-ignore
        resolver: parent => parent[name],
        extendsField,
      },
      this.typename,
    );
  }

  protected fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields<Types>, Nullable extends boolean>(
      options: Omit<
        SpiderSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, Args>,
        'type'
      >,
    ): Field<Args, Types, ParentType, Type, Nullable, null> => {
      return this.createField<Args, Type, Nullable, null>({ ...options, type }, null);
    };
  }

  protected exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <
      Nullable extends boolean,
      Name extends CompatibleTypes<Types, ParentType, Type, Nullable>
    >(
      name: Name,
      options: Omit<
        SpiderSchemaTypes.FieldOptions<Types, ParentType, Type, Nullable, {}>,
        'resolve' | 'type'
      > = {},
    ): Field<{}, Types, ParentType, Type, Nullable, null> => {
      return this.exposeField<Type, Nullable, Name, null>(name, { ...options, type }, null);
    };
  }
}
