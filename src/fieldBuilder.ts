import { TypeMap, TypeParam, FieldOptions, InputFields, CompatibleTypes } from './types';
import Field from './field';

export default class FieldBuilder<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Context
> {
  boolean = this.fieldTypeHelper('Boolean');

  float = this.fieldTypeHelper('Float');

  id = this.fieldTypeHelper('ID');

  int = this.fieldTypeHelper('Int');

  string = this.fieldTypeHelper('String');

  booleanList = this.fieldTypeHelper(['Boolean']);

  floatList = this.fieldTypeHelper(['Float']);

  idList = this.fieldTypeHelper(['ID']);

  intList = this.fieldTypeHelper(['Int']);

  stringList = this.fieldTypeHelper(['String']);

  exposBoolean = this.exposeHelper('Boolean');

  exposeFloat = this.exposeHelper('Float');

  exposeID = this.exposeHelper('ID');

  exposeInt = this.exposeHelper('Int');

  exposeString = this.exposeHelper('String');

  exposeBooleanList = this.exposeHelper(['Boolean']);

  exposeFloatList = this.exposeHelper(['Float']);

  exposeIDList = this.exposeHelper(['ID']);

  exposeIntList = this.exposeHelper(['Int']);

  exposeStringList = this.exposeHelper(['String']);

  field<Args extends InputFields, Type extends TypeParam<Types>, Req extends boolean>(
    options: FieldOptions<Types, ParentType, Type, Req, Args, Context>,
  ): Field<Args, Types, ParentType, Type, Req, Context> {
    return new Field<Args, Types, ParentType, Type, Req, Context>(options);
  }

  expose<
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

  private fieldTypeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Args extends InputFields, Req extends boolean>(
      options: Omit<FieldOptions<Types, ParentType, Type, Req, Args, Context>, 'type'>,
    ) => {
      return this.field<Args, Type, Req>({ ...options, type });
    };
  }

  private exposeHelper<Type extends TypeParam<Types>>(type: Type) {
    return <Req extends boolean, Name extends CompatibleTypes<Types, ParentType, Type, Req>>(
      name: Name,
      options: Omit<
        FieldOptions<Types, ParentType, Type, Req, {}, Context>,
        'resolver' | 'type'
      > = {},
    ) => {
      return this.expose<Type, Req, Name>(name, { ...options, type });
    };
  }
}
