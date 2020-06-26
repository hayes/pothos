/* eslint-disable max-classes-per-file */

import { outputShapeKey, OutputRef } from '../types';
import { SchemaTypes, InterfaceTypeOptions, InterfaceParam } from '..';
import BaseTypeRef from './base';

export default class InterfaceRef<T> extends BaseTypeRef implements OutputRef {
  kind = 'Interface' as const;

  name: string;

  [outputShapeKey]: T;

  constructor(name: string) {
    super();

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

  implement<Interfaces extends InterfaceParam<Types>[]>(
    options: InterfaceTypeOptions<
      Types,
      ImplementableInterfaceRef<Types, Shape>,
      Shape,
      Interfaces
    >,
  ) {
    return this.builder.interfaceType(this, options);
  }
}
