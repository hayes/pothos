import type { SchemaBuilder as Builder } from '../../builder';
import type { FieldBuilder as InternalFieldBuilder } from '../../fieldUtils/builder';
import type { InputFieldBuilder as InternalInputFieldBuilder } from '../../fieldUtils/input';
import type { MutationFieldBuilder as InternalMutationFieldBuilder } from '../../fieldUtils/mutation';
import type { QueryFieldBuilder as InternalQueryFieldBuilder } from '../../fieldUtils/query';
import type { RootFieldBuilder as InternalRootFieldBuilder } from '../../fieldUtils/root';
import type { SubscriptionFieldBuilder as InternalSubscriptionFieldBuilder } from '../../fieldUtils/subscription';
import type { BaseTypeRef as InternalBaseRef } from '../../refs/base';
import type { EnumRef as InternalEnumRef } from '../../refs/enum';
import type { InputListRef as InternalInputListRef } from '../../refs/input-list';
import type { InputObjectRef as InternalInputObjectRef } from '../../refs/input-object';
import type { InterfaceRef as InternalInterfaceRef } from '../../refs/interface';
import type { ListRef as InternalListRef } from '../../refs/list';
import type { ObjectRef as InternalObjectRef } from '../../refs/object';
import type { ScalarRef as InternalScalarRef } from '../../refs/scalar';
import type { UnionRef as InternalUnionRef } from '../../refs/union';
import type { FieldKind, FieldMode } from '../builder-options';
import type { SchemaTypes } from '../schema-types';

declare global {
  export namespace PothosSchemaTypes {
    export interface SchemaBuilder<Types extends SchemaTypes> extends Builder<Types> {}

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
      Mode extends FieldMode = Types['FieldMode'],
    > extends InternalRootFieldBuilder<Types, ParentShape, Kind, Mode> {}

    export interface FieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
      Mode extends FieldMode = Types['FieldMode'],
    > extends InternalFieldBuilder<Types, ParentShape, Kind, Mode> {}

    export interface QueryFieldBuilder<
      Types extends SchemaTypes,
      Mode extends FieldMode = Types['FieldMode'],
    > extends InternalQueryFieldBuilder<Types, Mode> {}

    export interface MutationFieldBuilder<
      Types extends SchemaTypes,
      Mode extends FieldMode = Types['FieldMode'],
    > extends InternalMutationFieldBuilder<Types, Mode> {}

    export interface SubscriptionFieldBuilder<
      Types extends SchemaTypes,
      Mode extends FieldMode = Types['FieldMode'],
    > extends InternalSubscriptionFieldBuilder<Types, Mode> {}

    export interface ObjectFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Mode extends FieldMode = Types['FieldMode'],
    > extends FieldBuilder<Types, ParentShape, 'Object', Mode> {}

    export interface InterfaceFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Mode extends FieldMode = Types['FieldMode'],
    > extends FieldBuilder<Types, ParentShape, 'Interface', Mode> {}

    export interface InputFieldBuilder<
      Types extends SchemaTypes,
      Kind extends 'Arg' | 'InputObject',
    > extends InternalInputFieldBuilder<Types, Kind> {}

    export interface BaseTypeRef<Types extends SchemaTypes, T> extends InternalBaseRef<Types, T> {}
    export interface EnumRef<Types extends SchemaTypes, T, U = T>
      extends InternalEnumRef<Types, T, U> {}
    export interface InputObjectRef<Types extends SchemaTypes, T>
      extends InternalInputObjectRef<Types, T> {}
    export interface InputListRef<Types extends SchemaTypes, T>
      extends InternalInputListRef<Types, T> {}
    export interface InterfaceRef<Types extends SchemaTypes, T, P = T>
      extends InternalInterfaceRef<Types, T, P> {}
    export interface ObjectRef<Types extends SchemaTypes, T, P = T>
      extends InternalObjectRef<Types, T, P> {}
    export interface ScalarRef<Types extends SchemaTypes, T, U, P = T>
      extends InternalScalarRef<Types, T, U, P> {}
    export interface UnionRef<Types extends SchemaTypes, T, P = T>
      extends InternalUnionRef<Types, T, P> {}
    export interface ListRef<Types extends SchemaTypes, T, P = T>
      extends InternalListRef<Types, T, P> {}
  }
}
