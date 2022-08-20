/* eslint-disable @typescript-eslint/no-unud-vars */
import {
  FieldKind,
  FieldNullability,
  FieldRef,
  InputFieldMap,
  InterfaceParam,
  PluginName,
  SchemaTypes,
  ShapeFromTypeParam,
  TypeParam,
} from '@pothos/core';
import {
  EdgeDBDriver,
  EdgeDBFieldOptions,
  EdgeDBSchemaTypeKeys,
  EdgeDBModelShape,
  EdgeDBModelTypes,
  EdgeDBObjectFieldOptions,
  EdgeDBObjectTypeOptions,
  EdgeDBQueryBuilder,
} from './types';
import type { EdgeDBPlugin } from '.';
import { EdgeDBObjectFieldBuilder as InternalEdgeDBObjectFieldBuilder } from './edgedb-field-builder';
import { edgeDBModelKey, EdgeDBObjectRef } from './object-ref';

declare global {
  export namespace PothosSchemaTypes {
    export interface Plugins<Types extends SchemaTypes> {
      edgedb: EdgeDBPlugin<Types>;
    }

    export interface UserSchemaTypes {
      EdgeDBTypes: { default: { [key: string]: unknown } };
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      EdgeDBTypes: PartialTypes['EdgeDBTypes'] & {};
    }

    export interface PothosKindToGraphQLType {
      EdgeDBObject: 'Object';
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      edgeDB: {
        qb: EdgeDBQueryBuilder;
        client: EdgeDBDriver;
        extensions?: {};
        exposeDescriptions?:
          | boolean
          | {
              types?: boolean;
              fields?: boolean;
            };
      };
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      customBuildTimeOptions?: boolean;
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes, Shape> {
      optionOnObject?: boolean;
    }

    export interface FieldOptionsByKind<
      Types extends SchemaTypes,
      ParentShape,
      Type extends TypeParam<Types>,
      Nullable extends FieldNullability<Type>,
      Args extends InputFieldMap,
      ResolveShape,
      ResolveReturnShape,
    > {
      EdgeDBObject: EdgeDBObjectFieldOptions<
        Types,
        ParentShape,
        Type,
        Nullable,
        Args,
        ResolveShape,
        ResolveReturnShape
      >;
    }

    export interface RootFieldBuilder<
      Types extends SchemaTypes,
      ParentShape,
      Kind extends FieldKind = FieldKind,
    > {
      edgeDBField: <
        Args extends InputFieldMap,
        TypeParam extends
          | EdgeDBObjectRef<EdgeDBModelTypes>
          | keyof Types['EdgeDBTypes']['default']
          | [keyof Types['EdgeDBTypes']['default']]
          | [EdgeDBObjectRef<EdgeDBModelTypes>],
        Nullable extends FieldNullability<Type>,
        ResolveShape,
        ResolveReturnShape,
        Type extends TypeParam extends [unknown]
          ? [ObjectRef<Model['Shape']>]
          : ObjectRef<Model['Shape']>,
        Model extends EdgeDBModelTypes = EdgeDBModelShape<
          Types,
          // @ts-expect-error -> string | number | symbol not assignable to ..
          TypeParam extends [keyof Types['EdgeDBTypes']['default']]
            ? keyof Types['EdgeDBTypes']['default'][TypeParam[0]]
            : TypeParam extends [EdgeDBObjectRef<EdgeDBModelTypes>]
            ? TypeParam[0][typeof edgeDBModelKey]
            : TypeParam extends EdgeDBObjectRef<EdgeDBModelTypes>
            ? TypeParam[typeof edgeDBModelKey]
            : TypeParam extends keyof Types['EdgeDBTypes']['default']
            ? TypeParam
            : never
        > &
          (TypeParam extends [keyof Types['EdgeDBTypes']['default']]
            ? Types['EdgeDBTypes']['default'][TypeParam[0]]
            : TypeParam extends [EdgeDBObjectRef<EdgeDBModelTypes>]
            ? TypeParam[0][typeof edgeDBModelKey]
            : TypeParam extends EdgeDBObjectRef<EdgeDBModelTypes>
            ? TypeParam[typeof edgeDBModelKey]
            : TypeParam extends keyof Types['EdgeDBTypes']['default']
            ? Types['EdgeDBTypes']['default'][TypeParam]
            : never),
      >(
        options: EdgeDBFieldOptions<
          Types,
          ParentShape,
          TypeParam,
          Model,
          Type,
          Args,
          Nullable,
          ResolveShape,
          ResolveReturnShape,
          Kind
        >,
      ) => FieldRef<ShapeFromTypeParam<Types, Type, Nullable>>;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      edgeDBObject: <
        Name extends EdgeDBSchemaTypeKeys<Types>,
        Interfaces extends InterfaceParam<Types>[],
        Model extends EdgeDBModelShape<Types, Name> & Types['EdgeDBTypes']['default'][Name],
        Shape extends object = Model['Shape'],
      >(
        name: Name,
        options: EdgeDBObjectTypeOptions<Types, Interfaces, Model, Shape>,
      ) => EdgeDBObjectRef<Model, Shape>;
    }

    export interface EdgeDBObjectFieldBuilder<
      Types extends SchemaTypes,
      Model extends EdgeDBModelTypes,
      Shape extends object = Model['Shape'],
    > extends InternalEdgeDBObjectFieldBuilder<Types, Model, Shape>,
        RootFieldBuilder<Types, Shape, 'EdgeDBObject'> {}
  }
}
