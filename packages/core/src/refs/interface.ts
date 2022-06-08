/* eslint-disable max-classes-per-file */

import {
  InterfaceParam,
  InterfaceTypeOptions,
  OutputRef,
  outputShapeKey,
  parentShapeKey,
  SchemaTypes,
} from '../types';
import BaseTypeRef from './base';

export default class InterfaceRef<T, P = T>
  extends BaseTypeRef
  implements OutputRef, PothosSchemaTypes.InterfaceRef<T, P>
{
  override kind = 'Interface' as const;

  [outputShapeKey]!: T;
  [parentShapeKey]!: P;

  constructor(name: string) {
    super('Interface', name);
  }
}

export class ImplementableInterfaceRef<
  Types extends SchemaTypes,
  Shape,
  Parent = Shape,
> extends InterfaceRef<Shape, Parent> {
  protected builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);

    this.builder = builder;
  }

  implement<Interfaces extends InterfaceParam<Types>[]>(
    options: InterfaceTypeOptions<
      Types,
      ImplementableInterfaceRef<Types, Shape, Parent>,
      Parent,
      Interfaces
    >,
  ) {
    return this.builder.interfaceType(this, options);
  }
}
