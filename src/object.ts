import BaseType from './base';
import { TypeMap, TypeParam, ShapeFromTypeParam, ObjectTypeOptions } from './types';

export default class ObjectType<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  Shape extends {},
  Context
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  // implements: (keyof Types)[];

  // fields: Field<Types>[] = [];

  constructor(name: Type, options: ObjectTypeOptions<Types, Type, Shape, Context>) {
    super(name as string);
    // this.implements = options.implements || [];
  }

  build() {
    return this;
  }
}
