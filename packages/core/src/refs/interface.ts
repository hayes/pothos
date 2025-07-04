import {
  type InterfaceParam,
  type InterfaceTypeOptions,
  type OutputRef,
  outputShapeKey,
  type PothosInterfaceTypeConfig,
  parentShapeKey,
  type SchemaTypes,
} from '../types';
import { TypeRefWithFields } from './base-with-fields';

export class InterfaceRef<Types extends SchemaTypes, T, P = T>
  extends TypeRefWithFields<Types, PothosInterfaceTypeConfig>
  implements OutputRef<T>, PothosSchemaTypes.InterfaceRef<Types, T, P>
{
  override kind = 'Interface' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(name: string, config?: PothosInterfaceTypeConfig) {
    super('Interface', name, config);
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

  implement<const Interfaces extends InterfaceParam<Types>[]>(
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
