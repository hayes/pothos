/* eslint-disable no-param-reassign */
import SchemaBuilder, {
  BasePlugin,
  GiraphQLEnumValueConfig,
  GiraphQLInputFieldConfig,
  GiraphQLOutputFieldConfig,
  GiraphQLTypeConfig,
  SchemaTypes,
} from '@giraphql/core';
import { GraphQLSchema } from 'graphql';
import { SchemaDirectiveVisitor } from '@graphql-tools/utils';
import './global-types';
import mockAst from './mock-ast';
import { DirectiveList } from './types';

export * from './types';

export default class DirectivesPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  onOutputFieldConfig(fieldConfig: GiraphQLOutputFieldConfig<Types>) {
    const options = fieldConfig.giraphqlOptions;

    if (options.directives) {
      fieldConfig.extensions = {
        ...fieldConfig.extensions,
        directives: normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  onInputFieldConfig(fieldConfig: GiraphQLInputFieldConfig<Types>) {
    const options = fieldConfig.giraphqlOptions;

    if (options.directives) {
      fieldConfig.extensions = {
        ...fieldConfig.extensions,
        directives: normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  onEnumValueConfig(valueConfig: GiraphQLEnumValueConfig<Types>) {
    const options = valueConfig.giraphqlOptions;

    if (options.directives) {
      valueConfig.extensions = {
        ...valueConfig.extensions,
        directives: normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  onTypeConfig(typeConfig: GiraphQLTypeConfig) {
    const options = typeConfig.giraphqlOptions;

    if (options.directives) {
      typeConfig.extensions = {
        ...typeConfig.extensions,
        directives: normalizeDirectives((options.directives as unknown) as Record<string, {}>),
      };
    }
  }

  afterBuild(schema: GraphQLSchema, options: GiraphQLSchemaTypes.BuildSchemaOptions<Types>) {
    mockAst(schema);

    if (this.builder.options.schemaDirectives) {
      SchemaDirectiveVisitor.visitSchemaDirectives(schema, this.builder.options.schemaDirectives);
    }
  }
}

function normalizeDirectives(directives: Record<string, {}> | DirectiveList) {
  if (Array.isArray(directives)) {
    return directives;
  }

  return Object.keys(directives).map((name) => ({ name, args: directives[name] }));
}

SchemaBuilder.registerPlugin('GiraphQLDirectives', DirectivesPlugin);
