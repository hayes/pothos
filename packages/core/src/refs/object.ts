/* eslint-disable max-classes-per-file */
import {
  InterfaceParam,
  ObjectTypeOptions,
  OutputRef,
  outputShapeKey,
  parentShapeKey,
  SchemaTypes,
} from '../types';
import BaseTypeRef from './base';

export default class ObjectRef<T, P = T>
  extends BaseTypeRef
  implements OutputRef, PothosSchemaTypes.ObjectRef<T, P>
{
  override kind = 'Object' as const;

  [outputShapeKey]!: T;
  [parentShapeKey]!: P;

  constructor(name: string) {
    super('Object', name);
  }
}

export class ImplementableObjectRef<
  Types extends SchemaTypes,
  Shape,
  Parent = Shape,
> extends ObjectRef<Shape, Parent> {
  protected builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement<Interfaces extends InterfaceParam<Types>[]>(
    options: Omit<
      ObjectTypeOptions<Types, ImplementableObjectRef<Types, Shape, Parent>, Parent, Interfaces>,
      'name'
    >,
  ): PothosSchemaTypes.ObjectRef<Shape, Parent> {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return this.builder.objectType(
      this,
      options as ObjectTypeOptions<
        Types,
        ImplementableObjectRef<Types, Shape, Parent>,
        Parent,
        Interfaces
      >,
    );
  }
}
