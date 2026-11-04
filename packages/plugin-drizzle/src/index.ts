import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  completeValue,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { findLoaderMapping, setFieldMapping } from '@pothos/selection-mapper';
import { getColumns, type Table, type TableRelationalConfig } from 'drizzle-orm';
import type { GraphQLFieldResolver, GraphQLObjectType, GraphQLResolveInfo } from 'graphql';
import type { ModelLoader } from './model-loader.js';
import type { PathInfo } from './types.js';
import { type DrizzleNode, drizzleAdapter } from './utils/adapter.js';
import { getSchemaConfig } from './utils/config.js';

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
  private typeNodes = new WeakMap<GraphQLObjectType, Map<string | undefined, TypeReloadNode>>();

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

    for (const parent of this.buildCache.getTypeConfig(iface, 'Interface').interfaces) {
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

  /**
   * Core runs this wrapper outside every plugin's `wrapResolve`, so a parent missing what its
   * type's `select` loads is reloaded here, before plugins listed earlier, such as scope-auth, read
   * it. Only the type-level selections are loaded, never the field's own `select`, which
   * `wrapResolve` loads for the field's resolver as it always has. A row that has them passes
   * through untouched.
   */
  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    if (!resolver) {
      return resolver;
    }

    const reload = this.typeReload(fieldConfig);

    if (!reload) {
      return resolver;
    }

    const { modelLoader, required, implementationKeys, parentTypes, declaringType } = reload;
    let node: TypeReloadNode | undefined;

    return (parent, args, context, info) => {
      const row = parent as Record<string, unknown>;
      let missing = false;

      for (const key of required) {
        if (row[key] === undefined) {
          missing = true;
          break;
        }
      }

      if (!missing) {
        for (const key of implementationKeys) {
          if (row[key] === undefined) {
            missing = !findLoaderMapping(context, info, parent, parentTypes);
            break;
          }
        }
      }

      if (!missing) {
        return resolver(parent, args, context, info);
      }

      node ??= this.typeNode(info.parentType, declaringType);

      if (node.unchecked) {
        throw new PothosValidationError(node.unchecked);
      }

      return modelLoader(context)
        .loadTypeSelection(node.root, row)
        .then((loaded) => resolver(loaded, args, context, info));
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

    const parentTypes = this.drizzleParentTypes(parentConfig, fieldConfig);

    const modelLoader = parentConfig.extensions?.pothosDrizzleLoader as ReturnType<
      typeof ModelLoader.forModel
    >;

    if (!modelLoader) {
      throw new Error(`ModelLoader not found for type ${parentConfig.name}`);
    }

    return (parent, args, context, info) => {
      const mapping = findLoaderMapping(context, info, parent, parentTypes);

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

  /**
   * What `wrapArgMappers` checks a field's parent for: null when scope-auth isn't installed or the
   * field's type checks read no type-level selection.
   */
  private typeReload(fieldConfig: PothosOutputFieldConfig<Types>) {
    const plugins: readonly string[] | undefined = this.builder.options.plugins;
    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const modelLoader = parentConfig.extensions?.pothosDrizzleLoader as
      | ReturnType<typeof ModelLoader.forModel>
      | undefined;

    if (!plugins?.includes('scopeAuth') || !modelLoader) {
      return null;
    }

    // A field an interface declares is checked against the interface's type-level selection: a
    // query that reaches the implementation only through the interface doesn't plan the
    // implementation's own.
    const declaringConfig = fieldConfig.declaringType
      ? this.buildCache.getTypeConfig(fieldConfig.declaringType)
      : parentConfig;
    const required = typeLevelKeys(declaringConfig);
    // scope-auth also runs the implementing type's authScopes on a field an interface declares.
    // Its type-level selection is only checked on a row no plan loaded, so a planned query through
    // the interface keeps its query count.
    const implementationKeys =
      declaringConfig === parentConfig
        ? []
        : typeLevelKeys(parentConfig).filter((key) => !required.includes(key));

    if (!required.length && !implementationKeys.length) {
      return null;
    }

    return {
      modelLoader,
      required,
      implementationKeys,
      parentTypes: this.drizzleParentTypes(parentConfig, fieldConfig),
      declaringType: fieldConfig.declaringType,
    };
  }

  /**
   * The node a row of `type` is reloaded with for a field `declaringType` declares (none for the
   * type's own fields), built once per pair. Fields whose nodes agree share one, so each row is
   * reloaded once.
   */
  private typeNode(type: GraphQLObjectType, declaringType: string | undefined) {
    let nodes = this.typeNodes.get(type);

    if (!nodes) {
      const { node, skipped } = this.typeLevelNode(type, undefined);

      nodes = new Map([[undefined, node]]);

      for (const iface of type.getInterfaces()) {
        if (!skipped.has(iface.name)) {
          nodes.set(iface.name, node);
        }
      }

      this.typeNodes.set(type, nodes);
    }

    let node = nodes.get(declaringType);

    if (!node) {
      node = this.typeLevelNode(type, declaringType).node;
      nodes.set(declaringType, node);
    }

    return node;
  }

  /**
   * The type-level selections scope-auth's checks on a field of `type` read: the type's, then the
   * one of the interface that declares the field, then those of the other drizzle interfaces `type`
   * implements, less any that conflicts with them (`skipped`), which their rows can't hold at once.
   * The type's own wins, as it does on a row planned for it. A skipped interface with authScopes
   * would be checked against another type's data, so the reload is refused (`unchecked`).
   */
  private typeLevelNode(type: GraphQLObjectType, declaringType: string | undefined) {
    const adapter = drizzleAdapter(getSchemaConfig(this.builder));
    const root = adapter.createNode(adapter.modelFor(type)!);
    const interfaces = type.getInterfaces().filter((iface) => adapter.modelFor(iface));
    const skipped = new Set<string>();
    let unchecked: string | undefined;
    const selection = adapter.typeSelection(type);

    if (selection) {
      adapter.mergeQuery(root, selection);
    }

    for (const iface of [
      ...interfaces.filter(({ name }) => name === declaringType),
      ...interfaces.filter(({ name }) => name !== declaringType),
    ]) {
      const selection = adapter.typeSelection(iface);

      if (!selection) {
        continue;
      }

      if (adapter.canMergeQuery(root, selection)) {
        adapter.mergeQuery(root, selection);
      } else {
        skipped.add(iface.name);

        if (
          !unchecked &&
          (this.buildCache.getTypeConfig(iface.name).pothosOptions as { authScopes?: unknown })
            .authScopes
        ) {
          unchecked = uncheckedScopesMessage(
            iface.name,
            type.name,
            adapter.firstConflict(root, selection),
          );
        }
      }
    }

    return { node: { root, unchecked }, skipped };
  }

  /** The field's parent type and the drizzle interfaces it implements. */
  private drizzleParentTypes(
    parentConfig: PothosTypeConfig,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ) {
    const parentTypes = new Set([parentConfig.name]);

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

    return parentTypes;
  }
}

/**
 * The top-level keys a type's `select` (`columns`, `with`, `extras`) puts on its rows. A `columns`
 * that only excludes selects every other column of the table.
 */
function typeLevelKeys(typeConfig: PothosTypeConfig): string[] {
  const { pothosDrizzleSelect: selection, pothosDrizzleTable } = typeConfig.extensions ?? {};

  if (!selection || typeof selection !== 'object') {
    return [];
  }

  const { columns, with: relations, extras } = selection as Record<string, unknown>;
  const keys = [...truthyKeys(relations), ...truthyKeys(extras)];
  const selected = truthyKeys(columns);

  if (selected.length > 0) {
    keys.push(...selected);
  } else if (columns && Object.values(columns).some((value) => value === false)) {
    const { table } = pothosDrizzleTable as TableRelationalConfig;

    for (const key of Object.keys(getColumns(table as Table))) {
      if ((columns as Record<string, unknown>)[key] !== false) {
        keys.push(key);
      }
    }
  }

  return keys;
}

function truthyKeys(part: unknown): string[] {
  if (!part || typeof part !== 'object') {
    return [];
  }

  return Object.keys(part).filter((key) => (part as Record<string, unknown>)[key]);
}

/** A type's reload node, or why its rows can't be reloaded for scope-auth's checks. */
interface TypeReloadNode {
  root: DrizzleNode;
  unchecked?: string;
}

/**
 * Why `iface`'s authScopes can't run on a row of `type` Pothos reloads: the row can hold only one
 * of their conflicting selections. Modelled on the planner's error for the same conflict.
 */
function uncheckedScopesMessage(
  iface: string,
  type: string,
  conflict: { kind: string; name: string } | undefined,
) {
  const unchecked = `so ${iface}'s authScopes can't be checked on a row Pothos reloads.`;

  switch (conflict?.kind) {
    case 'relation':
      return `Type-level selections of ${iface} and ${type} conflict on relation "${conflict.name}", ${unchecked} Move the relation arguments to a field-level select on one of the types.`;
    case 'extra':
      return `Type-level selections of ${iface} and ${type} conflict on extra "${conflict.name}", ${unchecked} Define the extra with the same function on both types, or move it to a field-level select on one of the types.`;
    default:
      return `Type-level selections of ${iface} and ${type} conflict, ${unchecked} Move the conflicting selection to a field-level select on one of the types.`;
  }
}

/** A falsy selection means the field selects nothing from the parent row. */
function wrapSelect(selected: {} | null) {
  return selected ? { columns: {}, ...selected } : null;
}

SchemaBuilder.registerPlugin(pluginName, PothosDrizzlePlugin, {});
