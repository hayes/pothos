/* eslint-disable no-param-reassign */
import './global-types';
import { GraphQLSchema } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  PothosEnumValueConfig,
  PothosInputFieldConfig,
  PothosOutputFieldConfig,
  PothosTypeConfig,
  SchemaTypes,
} from '@pothos/core';
import mockAst from './mock-ast';
import { DirectiveList } from './types';

export * from './types';

const pluginName = 'directives';

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
            fieldConfig.extensions?.directives as Record<string, {}>,
            options.directives as unknown as Record<string, {}>,
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
            fieldConfig.extensions?.directives as Record<string, {}>,
            options.directives as unknown as Record<string, {}>,
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
            valueConfig.extensions?.directives as Record<string, {}>,
            options.directives as unknown as Record<string, {}>,
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
            typeConfig.extensions?.directives as Record<string, {}>,
            options.directives as unknown as Record<string, {}>,
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
          (schema.extensions?.directives as Record<string, {}>) ?? {},
          this.options.schemaDirectives as unknown as Record<string, {}>,
        ),
      ),
    };

    mockAst(schema);

    return schema;
  }

  mergeDirectives(
    left: DirectiveList | Record<string, {}>,
    right: DirectiveList | Record<string, {}>,
  ) {
    if (!(left && right)) {
      return left || right;
    }

    return [
      ...(Array.isArray(left)
        ? left
        : Object.keys(left).map((name) => ({ name, args: left[name] }))),
      ...(Array.isArray(right)
        ? right
        : Object.keys(right).map((name) => ({ name, args: right[name] }))),
    ];
  }

  normalizeDirectives(directives: DirectiveList | Record<string, {}>) {
    if (this.builder.options.directives?.useGraphQLToolsUnorderedDirectives) {
      if (!Array.isArray(directives)) {
        return directives;
      }

      return directives.reduce<Record<string, {}[]>>((obj, directive) => {
        if (obj[directive.name]) {
          obj[directive.name].push(directive.args ?? {});
        } else {
          obj[directive.name] = [directive.args ?? {}];
        }

        return obj;
      }, {});
    }

    if (Array.isArray(directives)) {
      return directives;
    }

    return Object.keys(directives).map((name) => ({ name, args: directives[name] }));
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
