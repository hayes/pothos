import type { Step } from 'grafast';
import type { GraphQLObjectType } from 'graphql';

export interface AbstractTypePlanOptions<Source, T, Specifier = Source> {
  toSpecifier?($step: Step<Source>): Step<Specifier>;
  planType: (step: Step<Specifier>) => Specifier extends T
    ? {
        $__typename: Step<string | null>;
        planForType?: (t: GraphQLObjectType) => Step<T | null | undefined> | null;
      }
    : {
        $__typename: Step<string | null>;
        planForType: (t: GraphQLObjectType) => Step<T | null | undefined> | null;
      };
}

export interface ObjectTypePlanOptions<Source, T> {
  assertStep?:
    | ((step: Step) => asserts step is Step)
    | {
        // biome-ignore lint/suspicious/noExplicitAny: any is required for matching args
        new (...args: any[]): Step;
      }
    | null;
  planType?: (step: Step<Source>) => Step<T | null | undefined>;
}
