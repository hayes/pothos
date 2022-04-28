import { GraphQLResolveInfo } from 'graphql';
import { PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';

export type TracingFieldWrapper<Types extends SchemaTypes> = (
  fieldConfig: PothosOutputFieldConfig<Types>,
  value: Types['Tracing'],
) =>
  | null
  | ((
      next: () => unknown,
      parent: unknown,
      args: Record<string, unknown>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => unknown);
