import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  completeValue,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import { getLoaderMapping, type Position, setFieldMapping } from '@pothos/selection-mapper';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type { ModelLoader } from './model-loader.js';
import { pathInfoFor } from './utils/path-info.js';

export { drizzleConnectionHelpers } from './connection-helpers.js';
export { DrizzleObjectFieldBuilder } from './drizzle-field-builder.js';
export * from './types.js';
export { drizzleTableName } from './types.js';
export { drizzleClientCache } from './utils/config.js';

const pluginName = 'drizzle';

export default pluginName;

export class PothosDrizzlePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  // private mappingCache = new Map<
  //   string,
  //   InputTypeFieldsMapping<Types, DrizzleGraphQLInputExtensions>
  // >();
  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }

    let model = typeConfig.extensions?.pothosDrizzleModel as string | undefined;
    let table = typeConfig.extensions?.pothosDrizzleTable as TableRelationalConfig | undefined;

    for (const iface of typeConfig.interfaces) {
      const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const interfaceModel = interfaceConfig.extensions?.pothosDrizzleModel as string | undefined;

      if (interfaceModel) {
        if (model && model !== interfaceModel) {
          throw new PothosSchemaError(
            `DrizzleObjects must be based on the same prisma model as any DrizzleInterfaces they extend. ${typeConfig.name} uses ${model} and ${iface.name} uses ${interfaceModel}`,
          );
        }

        model = interfaceModel;
        // A plain object type implementing a drizzle interface is walked with the interface's
        // table, so fragments on it plan the relations it inherits.
        table ??= interfaceConfig.extensions?.pothosDrizzleTable as
          | TableRelationalConfig
          | undefined;
      }
    }

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        pothosDrizzleModel: model,
        pothosDrizzleTable: table,
      },
    };
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    // const argMappings = mapInputFields<Types, DrizzleGraphQLInputExtensions>(
    //   fieldConfig.args,
    //   this.buildCache,
    //   (inputField) => {
    //     if (inputField.type.kind === 'InputObject') {
    //       const config = this.buildCache.getTypeConfig(inputField.type.ref);

    //       return (config.extensions?.drizzleGraphQL as DrizzleGraphQLInputExtensions) ?? null;
    //     }

    //     return null;
    //   },
    //   this.mappingCache,
    // );

    // const argMapper = argMappings
    //   ? createInputValueMapper(argMappings, (input, mappings) => {
    //       if (!mappings.value) {
    //         return input;
    //       }

    //       const { table, tableConfig, inputType } = mappings.value;

    //       switch (inputType) {
    //         case 'orderBy':
    //           return extractOrderBy(tableConfig, input as never);
    //         case 'filters':
    //           return extractFilters(tableConfig, table, input as never);
    //         case 'insert':
    //           return remapFromGraphQLSingleInput(input as never, tableConfig);
    //         case 'update':
    //           return remapFromGraphQLSingleInput(input as never, tableConfig);

    //         default:
    //           throw new Error(`Unknown drizzle input type: ${inputType}`);
    //       }
    //     })
    //   : null;

    // const argMappers: typeof fieldConfig.argMappers = argMapper
    //   ? [...(fieldConfig.argMappers ?? []), (args) => argMapper(args, undefined)]
    //   : fieldConfig.argMappers;

    if (
      fieldConfig.kind === 'DrizzleObject' &&
      fieldConfig.pothosOptions.select &&
      !fieldConfig.extensions?.pothosDrizzleSelect
    ) {
      const { select } = fieldConfig.pothosOptions;
      return {
        ...fieldConfig,
        // argMappers,
        extensions: {
          ...fieldConfig.extensions,
          pothosDrizzleSelect:
            typeof select === 'function'
              ? (
                  args: {},
                  ctx: Types['Context'],
                  nestedQuery: (query: unknown, path?: string[]) => never,
                  _resolveSelection: unknown,
                  position: Position,
                ) => {
                  // The walk position, formatted as the `PathInfo` a `t.field` select reads off
                  // its `nestedQuery`, which is where this plugin has always carried it.
                  const nestedQueryWithPath = Object.assign(nestedQuery, pathInfoFor(position));
                  return completeValue(
                    (select as (args: unknown, ctx: unknown, nestedQuery: unknown) => {} | null)(
                      args,
                      ctx,
                      nestedQueryWithPath,
                    ),
                    wrapSelect,
                  );
                }
              : {
                  columns: {},
                  ...select,
                },
        },
      };
    }

    return {
      ...fieldConfig,
      // argMappers,
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (fieldConfig.kind !== 'DrizzleObject' || !fieldConfig.extensions?.pothosDrizzleSelect) {
      return resolver;
    }

    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    // A field can declare how to tell whether its data is already on the parent row. When the
    // row was not loaded from the planned query (a resolver returned a row it fetched itself),
    // the mapping alone is not proof, and the field falls back to the model loader.
    const loadedCheck = fieldConfig.extensions?.pothosDrizzleLoaded as
      | ((value: unknown, info: GraphQLResolveInfo, context: object) => boolean)
      | undefined;

    const parentTypes = new Set([fieldConfig.parentType]);

    if (parentConfig.kind === 'Interface' || parentConfig.kind === 'Object') {
      for (const iface of parentConfig.interfaces) {
        const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
        if (interfaceConfig.extensions?.pothosDrizzleModel) {
          parentTypes.add(interfaceConfig.name);
        }
      }
    }

    const modelLoader = parentConfig.extensions?.pothosDrizzleLoader as ReturnType<
      typeof ModelLoader.forModel
    >;

    if (!modelLoader) {
      throw new Error(`ModelLoader not found for type ${parentConfig.name}`);
    }

    return (parent, args, context, info) => {
      let mapping = getLoaderMapping(context, info.path, info.parentType.name);

      if (!mapping) {
        for (const parentType of parentTypes) {
          mapping = getLoaderMapping(context, info.path, parentType);
          if (mapping) {
            break;
          }
        }
      }

      if ((!loadedCheck || loadedCheck(parent, info, context)) && mapping) {
        // Recorded under the field's own parent type as well, so its resolver finds the pathInfo
        // it was planned with, whichever same-model type the plan was made for.
        setFieldMapping(context, info, mapping);

        return resolver(parent, args, context, info);
      }

      return modelLoader(context)
        .loadSelection(info, parent as object)
        .then((result) => resolver(result, args, context, info));
    };
  }
}

/** A falsy selection means the field selects nothing from the parent row. */
function wrapSelect(selected: {} | null) {
  return selected ? { columns: {}, ...selected } : null;
}

SchemaBuilder.registerPlugin(pluginName, PothosDrizzlePlugin, {});
