/* eslint-disable max-classes-per-file */
import { InterfaceParam, ObjectTypeOptions, parentShapeKey, SchemaTypes } from '../index.js';
import { OutputRef, outputShapeKey } from '../types/index.js';
import BaseTypeRef from './base.js';

export default class ObjectRef<T, P = T> extends BaseTypeRef implements OutputRef {
  override kind = 'Object' as const;

  [outputShapeKey]: T;
  [parentShapeKey]: P;

  constructor(name: string) {
    super('Object', name);
  }
}

export class ImplementableObjectRef<
  Types extends SchemaTypes,
  Shape,
  Parent = Shape,
> extends ObjectRef<Shape, Parent> {
  private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement<Interfaces extends InterfaceParam<Types>[]>(
    options: ObjectTypeOptions<
      Types,
      ImplementableObjectRef<Types, Shape, Parent>,
      Parent,
      Interfaces
    >,
  ) {
    return this.builder.objectType(this, options);
  }
}
