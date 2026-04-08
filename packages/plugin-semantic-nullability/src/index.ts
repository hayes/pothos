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

function makeNullableAtLevels<Types extends SchemaTypes>(
  type: PothosOutputFieldType<Types>,
  levels: Set<number>,
  current = 0,
): PothosOutputFieldType<Types> {
  const shouldConvert = levels.has(current) && !type.nullable;

  if (type.kind === 'List') {
    return {
      ...type,
      nullable: shouldConvert ? true : type.nullable,
      type: makeNullableAtLevels(type.type, levels, current + 1),
    };
  }

  return {
    ...type,
    nullable: shouldConvert ? true : type.nullable,
  };
}

function resolveOption(
  fieldOption: boolean | number[] | undefined,
  allNonNullFields: boolean,
): number[] | null {
  // Per-field option takes priority over the schema-wide default.
  const option = fieldOption ?? (allNonNullFields ? true : false);

  if (option === false) {
    return null;
  }

  if (option === true) {
    return [0];
  }

  return option;
}

function filterNonNullLevels<Types extends SchemaTypes>(
  type: PothosOutputFieldType<Types>,
  requestedLevels: number[],
  current = 0,
): number[] {
  const levels: number[] = [];

  if (requestedLevels.includes(current) && !type.nullable) {
    levels.push(current);
  }

  if (type.kind === 'List') {
    levels.push(...filterNonNullLevels(type.type, requestedLevels, current + 1));
  }

  return levels;
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

    const requestedLevels = resolveOption(fieldOption, allNonNullFields);

    if (!requestedLevels) {
      return fieldConfig;
    }

    // Only convert levels that are actually non-null
    const levels = filterNonNullLevels(fieldConfig.type, requestedLevels);

    if (levels.length === 0) {
      return fieldConfig;
    }

    // Omit levels arg when it's just [0] (the directive default)
    const directiveArgs = levels.length === 1 && levels[0] === 0 ? {} : { levels };

    return {
      ...fieldConfig,
      type: makeNullableAtLevels(fieldConfig.type, new Set(levels)),
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
