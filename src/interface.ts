import BaseType from './base';
import { TypeMap, TypeParam, ShapeFromTypeParam, InterfaceTypeOptions } from './types';

export default class InterfaceType<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  ParentShape extends {},
  Shape extends ParentShape,
  Context
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  // implements: (keyof Types)[];

  // fields: Field<Types>[] = [];

  objectShape!: Shape;

  constructor(name: Type, options: InterfaceTypeOptions<Types, Type, ParentShape, Shape, Context>) {
    super(name as string);
    // this.implements = options.implements || [];
  }

  build() {
    return this;
  }
}
