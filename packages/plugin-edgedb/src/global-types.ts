/* eslint-disable @typescript-eslint/no-unud-vars */
import {
  FieldNullability,
  InputFieldMap,
  InterfaceParam,
  SchemaTypes,
  TypeParam,
} from '@pothos/core';
import {
  EdgeDBDriver,
  EdgeDBModelShape,
  EdgeDBObjectFieldOptions,
  EdgeDBObjectTypeOptions,
  EdgeDBQueryBuilder,
  EdgeDBTypeKeys,
} from './types';
import type { EdgeDBPlugin } from '.';
import { EdgeDBObjectFieldBuilder as InternalEdgeDBObjectFieldBuilder } from './edgedb-field-builder';
import { EdgeDBObjectRef } from './object-ref';

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

    export interface SchemaBuilder<Types extends SchemaTypes> {
      edgeDBObject: <
        Name extends EdgeDBTypeKeys<Types>,
        Interfaces extends InterfaceParam<Types>[],
        Model extends EdgeDBModelShape<Types, Name>,
      >(
        name: Name,
        options: EdgeDBObjectTypeOptions<Types, Interfaces, Model>,
      ) => EdgeDBObjectRef<Types, Model>;
    }

    export interface EdgeDBObjectFieldBuilder<
      Types extends SchemaTypes,
      Model extends
        | ({ [ModelKey in keyof Model]: Model[ModelKey] extends infer U ? U : never } & {
            Fields: string | never;
            Links: {
              [Key in Model['Fields']]: {
                Shape: Model['Links'][Key];
              };
            };
          })
        | never,
      Shape extends object = Model,
    > extends InternalEdgeDBObjectFieldBuilder<Types, Model, Shape>,
        RootFieldBuilder<Types, Model, 'EdgeDBObject'> {}
  }
}
