/* eslint-disable max-classes-per-file */

import {
  InterfaceParam,
  InterfaceTypeOptions,
  OutputRef,
  outputShapeKey,
  parentShapeKey,
  PothosInterfaceTypeConfig,
  SchemaTypes,
} from '../types';
import { TypeRefWithFields } from './base-with-fields';
import { ListRef } from './list';
import { NonNullRef } from './non-null';

export class InterfaceRef<Types extends SchemaTypes, T, P = T>
  extends TypeRefWithFields<Types, PothosInterfaceTypeConfig>
  implements OutputRef, PothosSchemaTypes.InterfaceRef<Types, T, P>
{
  override kind = 'Interface' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(name: string, config?: PothosInterfaceTypeConfig) {
    super('Interface', name, config);
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }

  nonNull() {
    return new NonNullRef<Types, typeof this>(this);
  }
}

export class ImplementableInterfaceRef<
  Types extends SchemaTypes,
  Shape,
  Parent = Shape,
> extends InterfaceRef<Types, Shape, Parent> {
  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);
    this.builder = builder;
  }

  implement<Interfaces extends InterfaceParam<Types>[]>(
    options: InterfaceTypeOptions<Types, InterfaceRef<Types, Shape, Parent>, Parent, Interfaces>,
  ) {
    return this.builder.interfaceType(this as never, options);
  }
}
