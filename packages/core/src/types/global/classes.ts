/* eslint-disable @typescript-eslint/no-empty-interface */

import InternalFieldBuilder from '../../fieldUtils/builder';
import InternalRootFieldBuilder from '../../fieldUtils/root';
import InternalInputFieldBuilder from '../../fieldUtils/input';
import Builder from '../../builder';

import { SchemaTypes, FieldKind } from '../..';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface SchemaBuilder<Types extends SchemaTypes> extends Builder<Types> {}

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind
    > extends InternalRootFieldBuilder<Types, ParentShape, Kind> {}

    export interface FieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
    > extends RootFieldBuilder<Types, ParentShape, Kind>,
        InternalFieldBuilder<Types, ParentShape, Kind> {}

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
      Kind extends 'InputObject' | 'Arg'
    > extends InternalInputFieldBuilder<Types, Kind> {}
  }
}
