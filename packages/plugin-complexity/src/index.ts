import './global-types';
import { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  ContextCache,
  createContextCache,
  GiraphQLOutputFieldConfig,
  SchemaTypes,
} from '@giraphql/core';
import { calculateComplexity } from './calulate-complexity';
import { ComplexityResult } from './types';

export * from './types';

const pluginName = 'complexity' as const;

const DEFAULT_COMPLEXITY = 1;
const DEFAULT_LIST_MULTIPLIER = 10;

export default pluginName;

export class GiraphQLComplexityPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  defaultComplexity: number =
    this.options.complexity?.defaultComplexity ??
    this.builder.options?.complexity?.defaultComplexity ??
    DEFAULT_COMPLEXITY;
  defaultListMultiplier: number =
    this.options.complexity?.defaultListMultiplier ??
    this.builder.options.complexity?.defaultListMultiplier ??
    DEFAULT_LIST_MULTIPLIER;

  complexityCache: ContextCache<ComplexityResult, Types['Context'], [GraphQLResolveInfo]> =
    createContextCache((ctx: Types['Context'], info: GraphQLResolveInfo) =>
      calculateComplexity(this, ctx, info),
    );

  override onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        complexity: fieldConfig.giraphqlOptions.complexity,
      },
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: GiraphQLOutputFieldConfig<Types>,
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

    if (max.depth && max.depth < depth) {
      throw new Error(`Query exceeds maximum depth (depth: ${depth}, max: ${max.depth})`);
    }

    if (max.breadth && max.breadth < breadth) {
      throw new Error(`Query exceeds maximum breadth (breadth: ${breadth}, max: ${max.breadth})`);
    }

    if (max.complexity && max.complexity < complexity) {
      throw new Error(
        `Query exceeds maximum complexity (complexity: ${complexity}, max: ${max.complexity})`,
      );
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

SchemaBuilder.registerPlugin(pluginName, GiraphQLComplexityPlugin);
