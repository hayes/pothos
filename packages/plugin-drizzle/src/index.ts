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
import { getLoaderMapping, setFieldMapping } from '@pothos/selection-mapper';
import type { TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type { ModelLoader } from './model-loader.js';
import type { PathInfo } from './types.js';

export { drizzleConnectionHelpers } from './connection-helpers.js';
export { DrizzleObjectFieldBuilder } from './drizzle-field-builder.js';
export * from './types.js';
export { drizzleTableName } from './types.js';
export { drizzleClientCache, getSchemaConfig } from './utils/config.js';
export {
  type QueryFromInfoOptions,
  type QueryFromInfoResult,
  type QueryFromInfoReturn,
  queryFromInfo,
} from './utils/map-query.js';

const pluginName = 'drizzle';

export default pluginName;

export class PothosDrizzlePlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
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
            `DrizzleObjects must be based on the same drizzle table as any DrizzleInterfaces they extend. ${typeConfig.name} uses ${model} and ${iface.name} uses ${interfaceModel}`,
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
    if (
      fieldConfig.kind === 'DrizzleObject' &&
      fieldConfig.pothosOptions.select &&
      !fieldConfig.extensions?.pothosDrizzleSelect
    ) {
      const { select } = fieldConfig.pothosOptions;
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          pothosDrizzleSelect:
            typeof select === 'function'
              ? (
                  args: {},
                  ctx: Types['Context'],
                  nestedQuery: (query: unknown, path?: string[]) => never,
                  _resolveSelection: unknown,
                  pathInfo: PathInfo,
                ) => {
                  // A field's select also reads its metadata from the nested selection function.
                  // Forwarded lazily: reading the path ties the walk beneath the field to this
                  // invocation, so a select that never reads it keeps that walk shared.
                  const forward = (key: keyof PathInfo): PropertyDescriptor => ({
                    get: () => pathInfo[key],
                    // Assigning replaces the getter with the value, as it did a plain property.
                    set: (value: unknown) => {
                      Object.defineProperty(nestedQuery, key, {
                        value,
                        writable: true,
                        enumerable: true,
                        configurable: true,
                      });
                    },
                    enumerable: true,
                    configurable: true,
                  });
                  const nestedQueryWithPath = Object.defineProperties(nestedQuery, {
                    path: forward('path'),
                    segments: forward('segments'),
                  });
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
    };
  }

  /**
   * The options of the field `name` as `iface` defines it, or inherits it from an interface of its
   * own. Pothos builds an implementation's copy of an inherited field from those same options, so
   * they differ exactly when the implementation redefines the field.
   */
  private interfaceFieldOptions(iface: string, name: string): unknown {
    const own = this.builder.configStore.getFields(iface, 'Interface').get(name);

    if (own) {
      return own.pothosOptions;
    }

    const parents = this.buildCache.getTypeConfig(iface, 'Interface').interfaces;

    // Of several parents that declare the field, Pothos builds it from the one listed last.
    for (const parent of [...parents].reverse()) {
      const options = this.interfaceFieldOptions(
        this.buildCache.getTypeConfig(parent, 'Interface').name,
        name,
      );

      if (options !== undefined) {
        return options;
      }
    }

    return undefined;
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
        // A mapping recorded under the interface answers for this field only when the field is the
        // interface's own, inherited: an implementation that redefines it (other relation
        // arguments, say) would otherwise read what the interface's field loaded.
        if (
          interfaceConfig.extensions?.pothosDrizzleModel &&
          this.interfaceFieldOptions(interfaceConfig.name, fieldConfig.name) ===
            fieldConfig.pothosOptions
        ) {
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
      // Asked of the row: a mapping recorded for this row wins over the plan's, which answers
      // for the rows the planned query loaded.
      let mapping = getLoaderMapping(context, info.path, info.parentType.name, parent);

      if (!mapping) {
        for (const parentType of parentTypes) {
          mapping = getLoaderMapping(context, info.path, parentType, parent);
          if (mapping) {
            break;
          }
        }
      }

      if ((!loadedCheck || loadedCheck(parent, info, context)) && mapping) {
        // Recorded under the field's own parent type as well, so its resolver finds the pathInfo
        // it was planned with, whichever same-model type the plan was made for. Against the row
        // it resolves with: a sibling row of the same list may have been loaded by another plan.
        setFieldMapping(context, info, mapping, parent);

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
