import { GraphQLResolveInfo } from 'graphql';
import { PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';

export type TracingFieldWrapper<Types extends SchemaTypes> = (
  fieldConfig: PothosOutputFieldConfig<Types>,
  value: Exclude<Types['Tracing'], false | null>,
) =>
  | null
  | ((
      next: () => unknown,
      options: Exclude<Types['Tracing'], false | null>,
      parent: unknown,
      args: Record<string, unknown>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => unknown);

export type TracingFieldOptions<Types extends SchemaTypes, ParentShape, Args extends object> =
  | Types['Tracing']
  | ((
      parent: ParentShape,
      Args: Args,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => Types['Tracing']);
