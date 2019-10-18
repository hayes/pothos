import {
  TypeMap,
  TypeParam,
  FieldOptions,
  InputFields,
  CompatibleTypes,
  NamedTypeParam,
} from '../types';
import Field from '../field';
import BaseFieldUtil from './base';

export default class FieldBuilder<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Context
> extends BaseFieldUtil<Types, ParentType, Context> {
  boolean = this.fieldTypeHelper('Boolean' as NamedTypeParam<Types>);

  float = this.fieldTypeHelper('Float' as NamedTypeParam<Types>);

  id = this.fieldTypeHelper('ID' as NamedTypeParam<Types>);

  int = this.fieldTypeHelper('Int' as NamedTypeParam<Types>);

  string = this.fieldTypeHelper('String' as NamedTypeParam<Types>);

  booleanList = this.fieldTypeHelper(['Boolean']);

  floatList = this.fieldTypeHelper(['Float']);

  idList = this.fieldTypeHelper(['ID']);

  intList = this.fieldTypeHelper(['Int']);

  stringList = this.fieldTypeHelper(['String']);

  exposBoolean = this.exposeHelper('Boolean' as NamedTypeParam<Types>);

  exposeFloat = this.exposeHelper('Float' as NamedTypeParam<Types>);

  exposeID = this.exposeHelper('ID' as NamedTypeParam<Types>);

  exposeInt = this.exposeHelper('Int' as NamedTypeParam<Types>);

  exposeString = this.exposeHelper('String' as NamedTypeParam<Types>);

  exposeBooleanList = this.exposeHelper(['Boolean']);

  exposeFloatList = this.exposeHelper(['Float']);

  exposeIDList = this.exposeHelper(['ID']);

  exposeIntList = this.exposeHelper(['Int']);

  exposeStringList = this.exposeHelper(['String']);

  field<Args extends InputFields, Type extends TypeParam<Types>, Req extends boolean>(
    options: FieldOptions<Types, ParentType, Type, Req, Args, Context>,
  ): Field<Args, Types, ParentType, Type, Req, Context> {
    return this.createField(options);
  }

  expose<
    Type extends TypeParam<Types>,
    Req extends boolean,
    Name extends CompatibleTypes<Types, ParentType, Type, Req>
  >(
    name: Name,
    options: Omit<FieldOptions<Types, ParentType, Type, Req, {}, Context>, 'resolver'>,
  ) {
    return this.exposeField(name, options);
  }
}
