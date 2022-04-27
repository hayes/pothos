import { GraphQLResolveInfo } from 'graphql';
import { MaybePromise, PothosOutputFieldConfig, SchemaTypes } from '@pothos/core';

const nextTracer = Symbol.for('Pothos.nextTracer');

export type TracingFieldWrapper<Types extends SchemaTypes> = (
  fieldConfig: PothosOutputFieldConfig<Types>,
  value: Types['Tracing'],
) =>
  | null
  | ((
      next: () => MaybePromise<typeof nextTracer>,
      parent: unknown,
      args: Record<string, unknown>,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => MaybePromise<typeof nextTracer>);
