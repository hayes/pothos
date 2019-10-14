import BaseType from './base';
import {
  TypeMap,
  TypeParam,
  ShapeFromTypeParam,
  ObjectTypeOptions,
  CompatibleInterfaces,
  ObjectShapeFromInterfaces,
  InvalidType,
} from './types';
import InterfaceType from './interface';

export default class ObjectType<
  Types extends TypeMap,
  Type extends TypeParam<Types>,
  CheckedInterfaces extends CompatibleInterfaces<Types, Type, Interfaces>,
  ParentShape extends ObjectShapeFromInterfaces<Types, Interfaces>,
  Shape extends ParentShape,
  Context,
  Interfaces extends
    | InterfaceType<Types, TypeParam<Types>, {}, {}, {}>[]
    | InvalidType<unknown> = CheckedInterfaces
> extends BaseType<ShapeFromTypeParam<Types, Type, true>> {
  // implements: (keyof Types)[];

  // fields: Field<Types>[] = [];

  constructor(
    name: Type,
    options: ObjectTypeOptions<
      Types,
      Type,
      CheckedInterfaces,
      ParentShape,
      Shape,
      Context,
      Interfaces
    >,
  ) {
    super(name as string);
    // this.implements = options.implements || [];
  }

  build() {
    return this;
  }
}
