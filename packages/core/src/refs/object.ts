import {
  type InterfaceParam,
  type ObjectTypeOptions,
  type OutputRef,
  type PothosMutationTypeConfig,
  type PothosObjectTypeConfig,
  type PothosQueryTypeConfig,
  type PothosSubscriptionTypeConfig,
  type SchemaTypes,
  outputShapeKey,
  parentShapeKey,
} from '../types';
import { TypeRefWithFields } from './base-with-fields';

export type ObjectLikeConfig =
  | PothosMutationTypeConfig
  | PothosObjectTypeConfig
  | PothosQueryTypeConfig
  | PothosSubscriptionTypeConfig;
export class ObjectRef<Types extends SchemaTypes, T, P = T>
  extends TypeRefWithFields<Types, ObjectLikeConfig>
  implements OutputRef<T>, PothosSchemaTypes.ObjectRef<Types, T, P>
{
  override kind = 'Object' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(name: string, config?: ObjectLikeConfig) {
    super('Object', name, config);
  }
}

export class ImplementableObjectRef<
  Types extends SchemaTypes,
  Shape,
  Parent = Shape,
> extends ObjectRef<Types, Shape, Parent> {
  builder: PothosSchemaTypes.SchemaBuilder<Types>;

  constructor(builder: PothosSchemaTypes.SchemaBuilder<Types>, name: string) {
    super(name);
    this.builder = builder;
  }

  implement<const Interfaces extends InterfaceParam<Types>[]>(
    options: Omit<
      ObjectTypeOptions<Types, ImplementableObjectRef<Types, Shape, Parent>, Parent, Interfaces>,
      'name'
    >,
  ): PothosSchemaTypes.ObjectRef<Types, Shape, Parent> {
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
