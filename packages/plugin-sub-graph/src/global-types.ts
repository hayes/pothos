/* eslint-disable @typescript-eslint/no-unused-vars */
import { GraphQLSchema } from 'graphql';
import {
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputType,
  InterfaceParam,
  RootName,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { GiraphQLSubGraphPlugin } from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface BaseTypeOptions<Types extends SchemaTypes = SchemaTypes> {
      subGraphs?: Types['SubGraphs'][];
    }

    export interface BuildSchemaOptions<Types extends SchemaTypes> {
      subGraph?: Types['SubGraphs'] | Types['SubGraphs'][];
    }

    export interface ObjectTypeOptions<Types extends SchemaTypes = SchemaTypes, Shape = unknown>
      extends BaseTypeOptions<Types> {
      defaultSubGraphsForFields?: Types['SubGraphs'][];
    }

    export interface RootTypeOptions<Types extends SchemaTypes, Type extends RootName>
      extends BaseTypeOptions<Types> {
      defaultSubGraphsForFields?: Types['SubGraphs'][];
    }

    export interface InterfaceTypeOptions<
      Types extends SchemaTypes = SchemaTypes,
      Shape = unknown,
      Interfaces extends InterfaceParam<Types>[] = InterfaceParam<Types>[],
    > extends BaseTypeOptions<Types> {
      defaultSubGraphsForFields?: Types['SubGraphs'][];
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown,
    > {
      subGraphs?: Types['SubGraphs'][];
    }

    export interface Plugins<Types extends SchemaTypes> {
      subGraph: GiraphQLSubGraphPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      subGraphs?: {
        defaultForTypes?: Types['SubGraphs'][];
        defaultForFields?: Types['SubGraphs'][];
        fieldsInheritFromTypes?: boolean;
      };
    }

    export interface UserSchemaTypes {
      SubGraphs: string;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<UserSchemaTypes>> {
      SubGraphs: PartialTypes['SubGraphs'] extends string ? PartialTypes['SubGraphs'] : string;
    }
  }
}
