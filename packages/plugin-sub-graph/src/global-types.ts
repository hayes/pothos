/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  FieldNullability,
  FieldRequiredness,
  InputFieldMap,
  InputType,
  SchemaTypes,
  TypeParam,
} from '@giraphql/core';
import { GraphQLSchema } from 'graphql';
import SubGraphPlugin from '.';

declare global {
  export namespace GiraphQLSchemaTypes {
    export interface BaseTypeOptions<Types extends SchemaTypes = SchemaTypes> {
      subGraphs?: Types['SubGraphs'][];
    }

    export interface FieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      ParentShape = unknown,
      Type extends TypeParam<Types> = TypeParam<Types>,
      Nullable extends FieldNullability<Type> = FieldNullability<Type>,
      Args extends InputFieldMap = InputFieldMap,
      ResolveShape = unknown,
      ResolveReturnShape = unknown
    > {
      subGraphs?: Types['SubGraphs'][];
    }

    export interface InputFieldOptions<
      Types extends SchemaTypes = SchemaTypes,
      Type extends InputType<Types> | [InputType<Types>] = InputType<Types> | [InputType<Types>],
      Req extends FieldRequiredness<Type> = FieldRequiredness<Type>
    > {
      subGraphs?: Types['SubGraphs'][];
    }
    export interface Plugins<Types extends SchemaTypes> {
      GiraphQLSubGraph: SubGraphPlugin<Types>;
    }

    export interface SchemaBuilderOptions<Types extends SchemaTypes> {
      subGraph?: {
        defaultGraphsForType?: Types['SubGraphs'][];
        defaultGraphsForField?: Types['SubGraphs'][];
        inheritFieldGraphsFromType?: boolean;
      };
    }

    export interface TypeInfo {
      SubGraphs: string;
    }

    export interface ExtendDefaultTypes<PartialTypes extends Partial<TypeInfo>> {
      SubGraphs: PartialTypes['SubGraphs'] extends string ? PartialTypes['SubGraphs'] : string;
    }

    export interface SchemaBuilder<Types extends SchemaTypes> {
      toSubGraphSchema: (
        options: BuildSchemaOptions<Types>,
        subGraph: Types['SubGraphs'],
      ) => GraphQLSchema;
    }
  }
}
