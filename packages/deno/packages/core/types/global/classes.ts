// @ts-nocheck
import type { SchemaBuilder as Builder } from '../../builder.ts';
import type { FieldBuilder as InternalFieldBuilder } from '../../fieldUtils/builder.ts';
import type { InputFieldBuilder as InternalInputFieldBuilder } from '../../fieldUtils/input.ts';
import type { RootFieldBuilder as InternalRootFieldBuilder } from '../../fieldUtils/root.ts';
import type { BaseTypeRef as InternalBaseRef } from '../../refs/base.ts';
import type { EnumRef as InternalEnumRef } from '../../refs/enum.ts';
import type { InputListRef as InternalInputListRef } from '../../refs/input-list.ts';
import type { InputObjectRef as InternalInputObjectRef } from '../../refs/input-object.ts';
import type { InterfaceRef as InternalInterfaceRef } from '../../refs/interface.ts';
import type { ListRef as InternalListRef } from '../../refs/list.ts';
import type { ObjectRef as InternalObjectRef } from '../../refs/object.ts';
import type { ScalarRef as InternalScalarRef } from '../../refs/scalar.ts';
import type { UnionRef as InternalUnionRef } from '../../refs/union.ts';
import type { FieldKind } from '../builder-options.ts';
import type { SchemaTypes } from '../schema-types.ts';
declare global {
    export namespace PothosSchemaTypes {
        export interface SchemaBuilder<Types extends SchemaTypes> extends Builder<Types> {
        }
        export interface RootFieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> extends InternalRootFieldBuilder<Types, ParentShape, Kind> {
        }
        export interface FieldBuilder<Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind> extends InternalFieldBuilder<Types, ParentShape, Kind>, RootFieldBuilder<Types, ParentShape, Kind> {
        }
        export interface QueryFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Query"> {
        }
        export interface MutationFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Mutation"> {
        }
        export interface SubscriptionFieldBuilder<Types extends SchemaTypes, ParentShape> extends RootFieldBuilder<Types, ParentShape, "Subscription"> {
        }
        export interface ObjectFieldBuilder<Types extends SchemaTypes, ParentShape> extends FieldBuilder<Types, ParentShape, "Object"> {
        }
        export interface InterfaceFieldBuilder<Types extends SchemaTypes, ParentShape> extends FieldBuilder<Types, ParentShape, "Interface"> {
        }
        export interface InputFieldBuilder<Types extends SchemaTypes, Kind extends "Arg" | "InputObject"> extends InternalInputFieldBuilder<Types, Kind> {
        }
        export interface BaseTypeRef<Types extends SchemaTypes, T> extends InternalBaseRef<Types, T> {
        }
        export interface EnumRef<Types extends SchemaTypes, T, U = T> extends InternalEnumRef<Types, T, U> {
        }
        export interface InputObjectRef<Types extends SchemaTypes, T> extends InternalInputObjectRef<Types, T> {
        }
        export interface InputListRef<Types extends SchemaTypes, T> extends InternalInputListRef<Types, T> {
        }
        export interface InterfaceRef<Types extends SchemaTypes, T, P = T> extends InternalInterfaceRef<Types, T, P> {
        }
        export interface ObjectRef<Types extends SchemaTypes, T, P = T> extends InternalObjectRef<Types, T, P> {
        }
        export interface ScalarRef<Types extends SchemaTypes, T, U, P = T> extends InternalScalarRef<Types, T, U, P> {
        }
        export interface UnionRef<Types extends SchemaTypes, T, P = T> extends InternalUnionRef<Types, T, P> {
        }
        export interface ListRef<Types extends SchemaTypes, T, P = T> extends InternalListRef<Types, T, P> {
        }
    }
}
