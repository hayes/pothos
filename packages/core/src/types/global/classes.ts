import type Builder from '../../builder';
import type InternalFieldBuilder from '../../fieldUtils/builder';
import type InternalInputFieldBuilder from '../../fieldUtils/input';
import type InternalRootFieldBuilder from '../../fieldUtils/root';
import type InternalBaseRef from '../../refs/base';
import type InternalEnumRef from '../../refs/enum';
import type InternalInputListRef from '../../refs/input-list';
import type InternalInputObjectRef from '../../refs/input-object';
import type InternalInterfaceRef from '../../refs/interface';
import type InternalListRef from '../../refs/list';
import type InternalObjectRef from '../../refs/object';
import type InternalScalarRef from '../../refs/scalar';
import type InternalUnionRef from '../../refs/union';
import type { FieldKind } from '../builder-options';
import type { SchemaTypes } from '../schema-types';

declare global {
  export namespace PothosSchemaTypes {
    export interface SchemaBuilder<Types extends SchemaTypes> extends Builder<Types> {}

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > extends InternalRootFieldBuilder<Types, ParentShape, Kind> {}

    export interface FieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > extends InternalFieldBuilder<Types, ParentShape, Kind>,
        RootFieldBuilder<Types, ParentShape, Kind> {}

    export interface QueryFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends RootFieldBuilder<Types, ParentShape, 'Query'> {}

    export interface MutationFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends RootFieldBuilder<Types, ParentShape, 'Mutation'> {}

    export interface SubscriptionFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends RootFieldBuilder<Types, ParentShape, 'Subscription'> {}

    export interface ObjectFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends FieldBuilder<Types, ParentShape, 'Object'> {}

    export interface InterfaceFieldBuilder<Types extends SchemaTypes, ParentShape>
      extends FieldBuilder<Types, ParentShape, 'Interface'> {}

    export interface InputFieldBuilder<
      Types extends SchemaTypes,
      Kind extends 'Arg' | 'InputObject',
    > extends InternalInputFieldBuilder<Types, Kind> {}

    export interface BaseTypeRef extends InternalBaseRef {}
    export interface EnumRef<T, U = T> extends InternalEnumRef<T, U> {}
    export interface InputObjectRef<T> extends InternalInputObjectRef<T> {}
    export interface InputListRef<Types extends SchemaTypes, T>
      extends InternalInputListRef<Types, T> {}
    export interface InterfaceRef<T, P = T> extends InternalInterfaceRef<T, P> {}
    export interface ObjectRef<T, P = T> extends InternalObjectRef<T, P> {}
    export interface ScalarRef<T, U, P = T> extends InternalScalarRef<T, U, P> {}
    export interface UnionRef<T, P = T> extends InternalUnionRef<T, P> {}
    export interface ListRef<Types extends SchemaTypes, T, P = T>
      extends InternalListRef<Types, T, P> {}
  }
}
