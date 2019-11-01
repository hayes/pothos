import { TypeMap, TypeParam, FieldOptions, CompatibleTypes, InputFields } from '../types';
import BaseFieldUtil from './base';
import Field from '../field';

export default class FieldModifier<
  Types extends TypeMap,
  ParentType extends TypeParam<Types>,
  Type extends TypeParam<Types>,
  Nullable extends boolean,
  Args extends InputFields<Types>,
  Extends extends string,
  Context
> extends BaseFieldUtil<Types, ParentType, Context> {
  field: Field<Args, Types, ParentType, Type, Nullable, Context, string | null, any>;

  extendsField: Extends;

  constructor(
    field: Field<Args, Types, ParentType, Type, Nullable, Context, string | null, any>,
    extendsField: Extends,
  ) {
    super();
    this.field = field;
    this.extendsField = extendsField;
  }

  expose<Name extends CompatibleTypes<Types, ParentType, Type, Nullable>>(
    name: Name,
    options?: Omit<
      FieldOptions<Types, ParentType, Type, Nullable, {}, Context>,
      'resolve' | 'type' | 'args'
    >,
  ): Field<{}, Types, ParentType, Type, Nullable, Context, Extends> {
    return this.exposeField(name, { ...options, type: this.field.type }, this.extendsField);
  }

  implement(
    options: Omit<FieldOptions<Types, ParentType, Type, Nullable, Args, Context>, 'type' | 'args'>,
  ): Field<Args, Types, ParentType, Type, Nullable, Context, Extends> {
    return this.createField(
      { ...options, type: this.field.type, args: this.field.args },
      this.extendsField,
    );
  }
}
