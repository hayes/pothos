import './global-types';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  type PothosOutputFieldType,
  type SchemaTypes,
} from '@pothos/core';
import {
  DirectiveLocation,
  GraphQLDirective,
  GraphQLInt,
  GraphQLList,
  GraphQLNonNull,
  type GraphQLSchema,
} from 'graphql';

const pluginName = 'semanticNullability';

export default pluginName;

function collectNonNullLevels<Types extends SchemaTypes>(
  type: PothosOutputFieldType<Types>,
  level = 0,
): number[] {
  const levels: number[] = [];

  if (!type.nullable) {
    levels.push(level);
  }

  if (type.kind === 'List') {
    levels.push(...collectNonNullLevels(type.type, level + 1));
  }

  return levels;
}

function makeNullable<Types extends SchemaTypes>(
  type: PothosOutputFieldType<Types>,
): PothosOutputFieldType<Types> {
  if (type.kind === 'List') {
    return {
      ...type,
      nullable: true,
      type: makeNullable(type.type),
    };
  }

  return {
    ...type,
    nullable: true,
  };
}

export class PothosSemanticNullabilityPlugin<
  Types extends SchemaTypes,
> extends BasePlugin<Types> {
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> {
    const fieldOption = fieldConfig.pothosOptions.semanticNonNull;
    const allNonNullFields =
      this.builder.options.semanticNullability?.allNonNullFields ?? false;

    // Per-field option takes priority over the schema-wide default.
    const enabled = fieldOption ?? allNonNullFields;

    if (!enabled) {
      return fieldConfig;
    }

    // Collect which levels are non-null before we modify anything
    const levels = collectNonNullLevels(fieldConfig.type);

    // Nothing to convert if already fully nullable
    if (levels.length === 0) {
      return fieldConfig;
    }

    // Make all levels nullable and attach the directive.
    // Omit levels arg when it's just [0] (the default).
    const directiveArgs = levels.length === 1 && levels[0] === 0 ? {} : { levels };

    return {
      ...fieldConfig,
      type: makeNullable(fieldConfig.type),
      extensions: {
        ...fieldConfig.extensions,
        directives: mergeDirective(
          fieldConfig.extensions?.directives as DirectiveList | undefined,
          directiveArgs,
        ),
      },
    };
  }

  override afterBuild(schema: GraphQLSchema) {
    // Add the @semanticNonNull directive definition to the schema if not already present
    const existing = schema.getDirectives();
    const hasDirective = existing.some((d) => d.name === 'semanticNonNull');

    if (!hasDirective) {
      const directives = [
        ...existing,
        new GraphQLDirective({
          name: 'semanticNonNull',
          locations: [DirectiveLocation.FIELD_DEFINITION],
          args: {
            levels: {
              type: new GraphQLList(new GraphQLNonNull(GraphQLInt)),
              defaultValue: [0],
            },
          },
        }),
      ];

      // GraphQLSchema stores directives as a readonly array set during construction,
      // but we need to add our directive after the schema is built.
      Object.defineProperty(schema, '_directives', { value: directives });
    }

    return schema;
  }
}

type DirectiveList = Array<{ name: string; args: Record<string, unknown> }>;

function mergeDirective(
  existing: DirectiveList | undefined,
  directiveArgs: { levels?: number[] },
): DirectiveList {
  const existingDirectives = existing ?? [];

  return [
    ...(Array.isArray(existingDirectives)
      ? existingDirectives
      : Object.keys(existingDirectives).map((name) => ({
          name,
          args: (existingDirectives as unknown as Record<string, Record<string, unknown>>)[name],
        }))),
    { name: 'semanticNonNull', args: directiveArgs },
  ];
}

SchemaBuilder.registerPlugin(pluginName, PothosSemanticNullabilityPlugin);
