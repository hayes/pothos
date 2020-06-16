/* eslint-disable max-classes-per-file */

import { outputShapeKey, OutputRef } from '../types';
import { SchemaTypes } from '..';

export default class InterfaceRef<T> implements OutputRef {
  kind = 'Interface' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    this.name = name;
  }
}

export class ImplementableInterfaceRef<Types extends SchemaTypes, Shape> extends InterfaceRef<
  Shape
> {
  private builder: GiraphQLSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: GiraphQLSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement(options: GiraphQLSchemaTypes.InterfaceTypeOptions<Types, Shape>) {
    this.builder.interfaceType(this, options);
  }
}
