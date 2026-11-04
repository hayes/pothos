import './util/plugin-conflict.js';
import './global-types.js';
import './schema-builder.js';
import './field-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  completeValue,
  createContextCache,
  isThenable,
  type MaybePromise,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import { getLoaderMapping, setRowMappings } from '@pothos/selection-mapper';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import type { ModelLoader } from './model-loader.js';
import { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './prisma-field-builder.js';
import type { IncludeMap, PrismaModelTypes } from './types.js';
import { INCLUDE_ALL, type PrismaPlan } from './util/adapter.js';
import { formatPrismaCursor, parsePrismaCursor } from './util/cursors.js';
import { getModel, getRefFromModel } from './util/datamodel.js';
import { type FallbackPlanRecipe, fallbackQueryFromInfo, queryFromInfo } from './util/map-query.js';
import type { FieldMap } from './util/relation-map.js';

export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaInterfaceRef } from './interface-ref.js';
export { PrismaNodeRef } from './node-ref.js';
export { PrismaObjectRef, prismaModelKey } from './object-ref.js';
export * from './types.js';
export { prismaClientCache } from './util/get-client.js';

const pluginName = 'prisma';

export default pluginName;

export { formatPrismaCursor, getModel, getRefFromModel, parsePrismaCursor, queryFromInfo };

export type PrismaObjectFieldBuilder<
  Types extends SchemaTypes,
  ParentShape,
> = PothosSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;

export const ObjectFieldBuilder = InternalPrismaObjectFieldBuilder as new <
  Types extends SchemaTypes,
  Model extends PrismaModelTypes,
  Shape extends object = Model['Shape'],
>(
  typename: string,
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
) => PothosSchemaTypes.PrismaObjectFieldBuilder<Types, Model, Shape>;

export class PothosPrismaPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(cache: BuildCache<Types>) {
    super(cache, pluginName);
  }

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }

    let model = typeConfig.extensions?.pothosPrismaModel as string | undefined;
    let fieldMap = typeConfig.extensions?.pothosPrismaFieldMap as FieldMap | undefined;

    for (const iface of typeConfig.interfaces) {
      const interfaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const interfaceModel = interfaceConfig.extensions?.pothosPrismaModel as string | undefined;

      if (interfaceModel) {
        if (model && model !== interfaceModel) {
          throw new PothosSchemaError(
            `PrismaObjects must be based on the same prisma model as any PrismaInterfaces they extend. ${typeConfig.name} uses ${model} and ${iface.name} uses ${interfaceModel}`,
          );
        }

        model = interfaceModel;
        // A plain object type implementing a prisma interface is walked with the interface's
        // field map, so fragments on it plan the relations it inherits.
        fieldMap ??= interfaceConfig.extensions?.pothosPrismaFieldMap as FieldMap | undefined;
      }
    }

    const { pothosPrismaSelect: select, pothosPrismaInclude: include } = (typeConfig.extensions ??
      {}) as { pothosPrismaSelect?: IncludeMap; pothosPrismaInclude?: IncludeMap };

    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        pothosPrismaModel: model,
        pothosPrismaFieldMap: fieldMap,
        // The type-level selection merged whenever the type is walked, built once so the plan
        // allocates nothing per type: a model type without a `select` is include mode.
        pothosPrismaTypeSelection:
          select || include ? Object.freeze({ select, include }) : model ? INCLUDE_ALL : undefined,
      },
    };
  }

  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> | null {
    if (fieldConfig.kind === 'PrismaObject' && fieldConfig.pothosOptions.select) {
      const { select } = fieldConfig.pothosOptions;
      return {
        ...fieldConfig,
        extensions: {
          ...fieldConfig.extensions,
          pothosPrismaSelect:
            typeof select === 'function'
              ? (
                  args: {},
                  ctx: Types['Context'],
                  nestedQuery: (query: unknown, path?: string[], type?: string) => never,
                ) =>
                  completeValue(
                    (select as (args: unknown, ctx: unknown, nestedQuery: unknown) => {} | null)(
                      args,
                      ctx,
                      nestedQuery,
                    ),
                    wrapSelect,
                  )
              : select,
        },
      };
    }

    return fieldConfig;
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
   * Core runs this wrapper outside every plugin's `wrapResolve`, so a parent missing what the
   * type's `select`/`include` or the field's `select` loads is reloaded here, before plugins
   * listed earlier, such as scope-auth, read it. A row that has it passes through untouched.
   */
  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    if (!resolver) {
      return resolver;
    }

    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const loaderCache = parentConfig.extensions?.pothosPrismaLoader as
      | ((context: object) => ModelLoader)
      | undefined;

    if (!loaderCache) {
      return resolver;
    }

    // A field an interface declares is checked against the interface's type-level selection: a
    // query that reaches the implementation only through the interface doesn't plan the
    // implementation's own.
    const declaringConfig = fieldConfig.declaringType
      ? this.buildCache.getTypeConfig(fieldConfig.declaringType)
      : parentConfig;
    // Relation fields, the only ones with a fallback, can't declare a `select`.
    const ownSelect =
      fieldConfig.kind === 'PrismaObject'
        ? (fieldConfig.pothosOptions as { select?: unknown }).select
        : undefined;
    const required = [
      ...typeLevelKeys(declaringConfig),
      ...(typeof ownSelect === 'object' ? selectedKeys(ownSelect) : []),
    ];
    // scope-auth also runs the implementing type's checks on a field an interface declares. Its
    // type-level selection is only checked on a row no plan loaded, so a planned query through
    // the interface keeps its query count.
    const implementationKeys =
      declaringConfig === parentConfig
        ? []
        : typeLevelKeys(parentConfig).filter((key) => !required.includes(key));
    // A function `select` only shows its keys when it runs, so the plan's mapping is asked instead.
    const parentTypes =
      typeof ownSelect === 'function' || implementationKeys.length
        ? this.prismaParentTypes(parentConfig, fieldConfig)
        : null;
    const checkMapping = typeof ownSelect === 'function';

    if (!required.length && !parentTypes) {
      return resolver;
    }

    return (parent, args, context, info) => {
      const row = parent as Record<string, unknown>;
      let missing = false;

      for (const key of required) {
        if (row[key] === undefined) {
          missing = true;
          break;
        }
      }

      if (!missing && checkMapping && !findMapping(context, info, parent, parentTypes!)) {
        missing = true;
      }

      if (!missing) {
        for (const key of implementationKeys) {
          if (row[key] === undefined) {
            missing = !findMapping(context, info, parent, parentTypes!);
            break;
          }
        }
      }

      if (!missing) {
        return resolver(parent, args, context, info);
      }

      return loaderCache(context)
        .loadSelection(info, row)
        .then((result) => {
          if (result) {
            reloadedRows.set(info, result);
          }

          return resolver(result, args, context, info);
        });
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    if (fieldConfig.kind !== 'PrismaObject' || !fieldConfig.extensions?.pothosPrismaSelect) {
      return resolver;
    }

    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const loadedCheck = fieldConfig.extensions?.pothosPrismaLoaded as
      | ((val: unknown, info: GraphQLResolveInfo, context: object) => boolean)
      | undefined;
    const loaderCache = parentConfig.extensions?.pothosPrismaLoader as (
      model: unknown,
    ) => ModelLoader;

    const resolveFallback = fieldConfig.extensions?.pothosPrismaFallback as
      | ((
          query: {},
          parent: unknown,
          args: {},
          context: {},
          info: {},
          loader?: (model: unknown) => ModelLoader,
        ) => unknown)
      | undefined;

    const fallbackPlan = fieldConfig.extensions?.pothosPrismaFallbackPlan as
      | FallbackPlanRecipe
      | undefined;

    // The fallback with one settled plan per `Type@path` per request beside it, since it plans
    // this field again for every row of the list its parent came from. Allocated only for a field
    // that has a fallback, and scoped to the field config, so the plans of a request go with the
    // request and the builder's own `skipDeferredFragments` is the one that applies.
    const fallback = resolveFallback && {
      resolve: resolveFallback,
      plan: fallbackPlan,
      plans: createContextCache(() => new Map<string, MaybePromise<PrismaPlan>>()),
    };

    const parentTypes = this.prismaParentTypes(parentConfig, fieldConfig);

    return (parent, args, context, info) => {
      const mapping = findMapping(context, info, parent, parentTypes);

      if ((!loadedCheck || loadedCheck(parent, info, context)) && mapping) {
        // Against the row it resolves with: a sibling row of the same list may have been loaded
        // by another plan, and must keep answering from that one.
        setRowMappings(context, info, mapping.nested);

        return resolver(parent, args, context, info);
      }

      // `wrapArgMappers` already reloaded this row with the field's selection. The reload records
      // the mappings beneath the field but not the field's own, so the lookup above misses it.
      if (reloadedRows.get(info) === parent) {
        return resolver(parent, args, context, info);
      }

      if (fallback) {
        const query = fallbackQueryFromInfo(
          fallback.plans(context),
          context,
          info,
          this.builder.options.prisma.skipDeferredFragments,
          fallback.plan,
        );

        return isThenable(query)
          ? query.then((resolved) =>
              fallback.resolve(resolved as {}, parent, args, context, info, loaderCache),
            )
          : fallback.resolve(query, parent, args, context, info, loaderCache);
      }

      return loaderCache(context)
        .loadSelection(info, parent as object)
        .then((result) => resolver(result, args, context, info));
    };
  }

  /** The field's parent type and the prisma interfaces it implements. */
  private prismaParentTypes(
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
          interfaceConfig.extensions?.pothosPrismaModel &&
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

/** The row `wrapArgMappers` reloaded for a field, keyed by the field's resolve info. */
const reloadedRows = new WeakMap<GraphQLResolveInfo, object>();

/**
 * Asked of the row: a mapping recorded for this row wins over the plan's, which answers for the
 * rows the planned query loaded.
 */
function findMapping(
  context: object,
  info: GraphQLResolveInfo,
  parent: unknown,
  parentTypes: Set<string>,
) {
  const mapping = getLoaderMapping(context, info.path, info.parentType.name, parent);

  if (mapping) {
    return mapping;
  }

  for (const parentType of parentTypes) {
    const found = getLoaderMapping(context, info.path, parentType, parent);
    if (found) {
      return found;
    }
  }

  return null;
}

/** The top-level keys a type's `select` or `include` puts on its rows. */
function typeLevelKeys(typeConfig: PothosTypeConfig) {
  const { pothosPrismaSelect, pothosPrismaInclude } = (typeConfig.extensions ?? {}) as {
    pothosPrismaSelect?: {};
    pothosPrismaInclude?: {};
  };

  return [...selectedKeys(pothosPrismaSelect), ...selectedKeys(pothosPrismaInclude)];
}

/** The top-level keys a `select` or `include` map puts on the row. */
function selectedKeys(selection: object | null | undefined): string[] {
  if (!selection) {
    return [];
  }

  return Object.keys(selection).filter((key) => (selection as Record<string, unknown>)[key]);
}

/** A falsy selection means the field selects nothing from the parent row. */
function wrapSelect(selected: {} | null) {
  return selected ? { select: selected } : null;
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaPlugin, {
  v3: (options) => ({
    prisma: {
      ...options.prisma,
      filterConnectionTotalCount: options.prisma?.filterConnectionTotalCount ?? false,
    },
  }),
});
