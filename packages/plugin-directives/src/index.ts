import './global-types.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosEnumValueConfig,
  type PothosInputFieldConfig,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLSchema } from 'graphql';
import mockAst from './mock-ast.js';
import type { DirectiveList } from './types.js';

export * from './types.js';

const pluginName = 'directives';

function toDirectiveList(directives: DirectiveList | Record<string, object>): DirectiveList {
  if (Array.isArray(directives)) {
    return directives;
  }

  // Unordered (graphql-tools) directives use an array of arg objects for repeated directives,
  // each of which becomes its own entry in the ordered list.
  return Object.keys(directives).flatMap((name) => {
    const args = directives[name];

    return Array.isArray(args)
      ? (args as object[]).map((entry) => ({ name, args: entry }))
      : [{ name, args }];
  });
}

export default pluginName;
export class PothosDirectivesPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onOutputFieldConfig(fieldConfig: PothosOutputFieldConfig<Types>) {
    const options = fieldConfig.pothosOptions;

    if (!options.directives && !fieldConfig.extensions?.directives) {
      return fieldConfig;
    }

    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        directives: this.normalizeDirectives(
          this.mergeDirectives(
            fieldConfig.extensions?.directives as Record<string, object>,
            options.directives as unknown as Record<string, object>,
          ),
        ),
      },
    };
  }

  override onInputFieldConfig(fieldConfig: PothosInputFieldConfig<Types>) {
    const options = fieldConfig.pothosOptions;

    if (!options.directives && !fieldConfig.extensions?.directives) {
      return fieldConfig;
    }

    return {
      ...fieldConfig,
      extensions: {
        ...fieldConfig.extensions,
        directives: this.normalizeDirectives(
          this.mergeDirectives(
            fieldConfig.extensions?.directives as Record<string, object>,
            options.directives as unknown as Record<string, object>,
          ),
        ),
      },
    };
  }

  override onEnumValueConfig(valueConfig: PothosEnumValueConfig<Types>) {
    const options = valueConfig.pothosOptions;

    if (!options.directives && !valueConfig.extensions?.directives) {
      return valueConfig;
    }

    return {
      ...valueConfig,
      extensions: {
        ...valueConfig.extensions,
        directives: this.normalizeDirectives(
          this.mergeDirectives(
            valueConfig.extensions?.directives as Record<string, object>,
            options.directives as unknown as Record<string, object>,
          ),
        ),
      },
    };
  }

  override onTypeConfig(typeConfig: PothosTypeConfig) {
    const options = typeConfig.pothosOptions;

    if (!options.directives && !typeConfig.extensions?.directives) {
      return typeConfig;
    }

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        directives: this.normalizeDirectives(
          this.mergeDirectives(
            typeConfig.extensions?.directives as Record<string, object>,
            options.directives as unknown as Record<string, object>,
          ),
        ),
      },
    };
  }

  override afterBuild(schema: GraphQLSchema) {
    schema.extensions = {
      ...schema.extensions,
      directives: this.normalizeDirectives(
        this.mergeDirectives(
          (schema.extensions?.directives as Record<string, object>) ?? {},
          this.options.schemaDirectives as unknown as Record<string, object>,
        ),
      ),
    };

    mockAst(schema);

    return schema;
  }

  mergeDirectives(
    left: DirectiveList | Record<string, object>,
    right: DirectiveList | Record<string, object>,
  ) {
    if (!(left && right)) {
      return left || right;
    }

    return [...toDirectiveList(left), ...toDirectiveList(right)];
  }

  normalizeDirectives(directives: DirectiveList | Record<string, object>) {
    if (this.builder.options.directives?.useGraphQLToolsUnorderedDirectives) {
      if (!Array.isArray(directives)) {
        return directives;
      }

      // Directive names may collide with Object.prototype members (eg. `constructor`), so
      // accumulate into a Map rather than reading back from a plain object.
      const byName = new Map<string, {}[]>();

      for (const directive of directives) {
        const args = byName.get(directive.name);

        if (args) {
          args.push(directive.args ?? {});
        } else {
          byName.set(directive.name, [directive.args ?? {}]);
        }
      }

      return Object.fromEntries(byName);
    }

    return toDirectiveList(directives);
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosDirectivesPlugin, {
  v3: (options) => ({
    useGraphQLToolsUnorderedDirectives: undefined,
    directives: {
      useGraphQLToolsUnorderedDirectives: options.useGraphQLToolsUnorderedDirectives,
    },
  }),
});
