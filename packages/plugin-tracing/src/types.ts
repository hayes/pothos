import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';

export type TracingFieldWrapper<Types extends SchemaTypes> = (
  resolver: GraphQLFieldResolver<unknown, Types['Context'], Record<string, unknown>>,
  value: Exclude<Types['Tracing'], false | null>,
  fieldConfig: PothosOutputFieldConfig<Types>,
) => GraphQLFieldResolver<unknown, Types['Context'], Record<string, unknown>>;

export type TracingFieldOptions<Types extends SchemaTypes, ParentShape, Args extends object> =
  | Types['Tracing']
  | ((
      parent: ParentShape,
      Args: Args,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => Types['Tracing']);
