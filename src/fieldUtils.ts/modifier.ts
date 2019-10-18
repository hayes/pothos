import { TypeMap, TypeParam, FieldOptions, CompatibleTypes, InputFields } from '../types';
import BaseFieldUtil from './base';

export default class FieldModifier<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  ParentType extends TypeParam<Types>,
  Req extends boolean,
  Args extends InputFields,
  Context
> extends BaseFieldUtil<Types, ParentType, Context> {
  type: Type;

  required: Req;

  args: Args;

  constructor(type: Type, required: Req, args: Args) {
    super();
    this.type = type;
    this.required = required;
    this.args = args;
  }

  expose<Name extends CompatibleTypes<Types, ParentType, Type, Req>>(
    name: Name,
    options: Omit<
      FieldOptions<Types, ParentType, Type, Req, {}, Context>,
      'resolver' | 'type' | 'args'
    >,
  ) {
    return this.exposeField(name, { ...options, type: this.type });
  }

  implement(
    options: Omit<FieldOptions<Types, ParentType, Type, Req, {}, Context>, 'type' | 'args'>,
  ) {
    return this.createField({ ...options, type: this.type, args: this.args });
  }
}
