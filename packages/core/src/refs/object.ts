/* eslint-disable max-classes-per-file */
import {
  InterfaceParam,
  ObjectTypeOptions,
  OutputRef,
  outputShapeKey,
  parentShapeKey,
  PothosMutationTypeConfig,
  PothosObjectTypeConfig,
  PothosQueryTypeConfig,
  PothosSubscriptionTypeConfig,
  SchemaTypes,
} from '../types';
import { TypeRefWithFields } from './base-with-fields';
import { ListRef } from './list';
import { NonNullRef } from './non-null';

export type ObjectLikeConfig =
  | PothosMutationTypeConfig
  | PothosObjectTypeConfig
  | PothosQueryTypeConfig
  | PothosSubscriptionTypeConfig;
export class ObjectRef<Types extends SchemaTypes, T, P = T>
  extends TypeRefWithFields<Types, ObjectLikeConfig>
  implements OutputRef, PothosSchemaTypes.ObjectRef<Types, T, P>
{
  override kind = 'Object' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  constructor(name: string, config?: ObjectLikeConfig) {
    super('Object', name, config);
  }

  list() {
    return new ListRef<Types, typeof this>(this);
  }

  nonNull() {
    return new NonNullRef<Types, typeof this>(this);
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

  implement<Interfaces extends InterfaceParam<Types>[]>(
    options: Omit<
      ObjectTypeOptions<Types, ObjectRef<Types, Shape, Parent>, Parent, Interfaces>,
      'name'
    >,
  ): PothosSchemaTypes.ObjectRef<Types, Shape, Parent> {
    return this.builder.objectType(
      this as never,
      options as ObjectTypeOptions<Types, ObjectRef<Types, Shape, Parent>, Parent, Interfaces>,
    );
  }
}
