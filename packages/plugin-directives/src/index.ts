/* eslint-disable no-param-reassign */
import './global-types';
import { GraphQLSchema } from 'graphql';
import SchemaBuilder, {
  BasePlugin,
  GiraphQLEnumValueConfig,
  GiraphQLInputFieldConfig,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  SchemaTypes,
} from '@giraphql/core';
import mockAst from './mock-ast';
import { DirectiveList } from './types';

export * from './types';

const pluginName = 'directives' as const;

export default pluginName;
export class GiraphQLDirectivesPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    const options = fieldConfig.giraphqlOptions;

    if (options.directives) {
      fieldConfig.extensions = {
        ...fieldConfig.extensions,
        directives: this.normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    const options = fieldConfig.giraphqlOptions;

    if (options.directives) {
      fieldConfig.extensions = {
        ...fieldConfig.extensions,
        directives: this.normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
    const options = valueConfig.giraphqlOptions;

    if (options.directives) {
      valueConfig.extensions = {
        ...valueConfig.extensions,
        directives: this.normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    const options = typeConfig.giraphqlOptions;

    if (options.directives) {
      typeConfig.extensions = {
        ...typeConfig.extensions,
        directives: this.normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  afterBuild(schema: GraphQLSchema, options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {
    mockAst(schema);
  }

  normalizeDirectives(directives: DirectiveList | Record<string, {}>) {
    if (this.builder.options.useGraphQLToolsUnorderedDirectives) {
      if (!Array.isArray(directives)) {
        return directives;
      }

      return directives.reduce<Record<string, {}[]>>((obj, directive) => {
        if (obj[directive.name]) {
          obj[directive.name].push(directive.args || {});
        } else {
          obj[directive.name] = [directive.args || {}];
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

SchemaBuilder.registerPlugin(pluginName, GiraphQLDirectivesPlugin);
