import { TypeMap, TypeParam, FieldOptions, InputFields, CompatibleTypes } from '../types';
import Field from '../field';

export default class BaseFieldUtil<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Context
> {
  protected createField<
    Args extends InputFields,
    Type extends TypeParam<Types>,
    Req extends boolean
  >(
    options: FieldOptions<Types, ParentType, Type, Req, Args, Context>,
  ): Field<Args, Types, ParentType, Type, Req, Context> {
    return new Field<Args, Types, ParentType, Type, Req, Context>(options);
  }

  protected exposeField<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Req>
  >(
    name: Name,
    options: Omit<FieldOptions<Types, ParentType, Type, Req, {}, Context>, 'resolver'>,
  ): Field<{}, Types, ParentType, Type, Req, Context> {
    return new Field<{}, Types, ParentType, Type, Req, Context>({
      ...options,
      resolver: parent => parent[name],
    });
  }

  protected fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields, Req extends boolean>(
      options: Omit<FieldOptions<Types, ParentType, Type, Req, Args, Context>, 'type'>,
    ) => {
      return this.createField<Args, Type, Req>({ ...options, type });
    };
  }

  protected exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Req extends boolean, Name extends CompatibleTypes<Types, ParentType, Type, Req>>(
      name: Name,
      options: Omit<
        FieldOptions<Types, ParentType, Type, Req, {}, Context>,
        'resolver' | 'type'
      > = {},
    ) => {
      return this.exposeField<Type, Req, Name>(name, { ...options, type });
    };
  }
}
