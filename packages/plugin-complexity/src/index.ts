import './global-types';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  ContextCache,
  createContextCache,
  PothosOutputFieldConfig,
  SchemaTypes,
} from '@pothos/core';
import { calculateComplexity } from './calculate-complexity';
import { ComplexityErrorFn, ComplexityErrorKind, ComplexityResult } from './types';
import { DEFAULT_COMPLEXITY, DEFAULT_LIST_MULTIPLIER } from './util';

export * from './types';

const pluginName = 'complexity' as const;

export default pluginName;

export class PothosComplexityPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  defaultComplexity: number =
    this.options.complexity?.defaultComplexity ??
    this.builder.options?.complexity?.defaultComplexity ??
    DEFAULT_COMPLEXITY;
  defaultListMultiplier: number =
    this.options.complexity?.defaultListMultiplier ??
    this.builder.options.complexity?.defaultListMultiplier ??
    DEFAULT_LIST_MULTIPLIER;

  complexityError: ComplexityErrorFn =
    this.builder.options.complexity?.complexityError ??
    ((kind, { depth, breadth, complexity, maxBreadth, maxComplexity, maxDepth }) => {
      if (kind === ComplexityErrorKind.Depth) {
        return new Error(`Query exceeds maximum depth (depth: ${depth}, max: ${maxDepth})`);
      }

      if (kind === ComplexityErrorKind.Breadth) {
        return new Error(`Query exceeds maximum breadth (breadth: ${breadth}, max: ${maxBreadth})`);
      }

      if (kind === ComplexityErrorKind.Complexity) {
        return new Error(
          `Query exceeds maximum complexity (complexity: ${complexity}, max: ${maxComplexity})`,
        );
      }

      throw new Error('Unexpected complexity error kind');
    });

  complexityCache: ContextCache<ComplexityResult, Types['Context'], [GraphQLResolveInfo]> =
    createContextCache((ctx: Types['Context'], info: GraphQLResolveInfo) =>
      calculateComplexity(ctx, info),
    );

  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        complexity:
          fieldConfig.pothosOptions.complexity ??
          (fieldConfig.type.kind === 'List'
            ? {
                field: this.defaultComplexity,
                multiplier: this.defaultListMultiplier,
              }
            : this.defaultComplexity),
      },
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (
      fieldConfig.kind !== 'Query' &&
      fieldConfig.kind !== 'Mutation' &&
      fieldConfig.kind !== 'Subscription'
    ) {
      return resolver;
    }

    return (parent, args, context, info) => {
      this.checkComplexity(context, info);
      return resolver(parent, args, context, info);
    };
  }

  checkComplexity(ctx: Types['Context'], info: GraphQLResolveInfo) {
    const max = this.getMax(ctx);

    if (!max) {
      return;
    }

    const { complexity, depth, breadth } = this.complexityCache(ctx, info);

    let errorKind: ComplexityErrorKind | null = null;

    if (max.depth && max.depth < depth) {
      errorKind = ComplexityErrorKind.Depth;
    } else if (max.breadth && max.breadth < breadth) {
      errorKind = ComplexityErrorKind.Breadth;
    } else if (max.complexity && max.complexity < complexity) {
      errorKind = ComplexityErrorKind.Complexity;
    }

    if (errorKind) {
      const error = this.complexityError(
        errorKind,
        {
          complexity,
          depth,
          breadth,
          maxComplexity: max.complexity,
          maxDepth: max.depth,
          maxBreadth: max.breadth,
        },
        info,
      );

      throw typeof error === 'string' ? new Error(error) : error;
    }
  }

  getMax(ctx: Types['Context']) {
    let max = this.options.complexity?.limit ?? this.builder.options.complexity?.limit;

    if (typeof max === 'function') {
      max = max(ctx);
    }

    if (max?.complexity || max?.depth || max?.breadth) {
      return max;
    }

    return null;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosComplexityPlugin);
