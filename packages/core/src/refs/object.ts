/* eslint-disable max-classes-per-file */
import { outputShapeKey, OutputRef } from '../types';
import { SchemaTypes, InterfaceParam, ObjectTypeOptions } from '..';

export default class ObjectRef<T> implements OutputRef {
  kind = 'Object' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    this.name = name;
  }
}

export class ImplementableObjectRef<
  Types extends SchemaTypes,
  Shape,
  Interfaces extends InterfaceParam<Types>[]
> extends ObjectRef<Shape> {
  private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement(options: ObjectTypeOptions<Types, Shape, Interfaces>) {
    this.builder.objectType(this, options);
  }
}
