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
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { findLoaderMapping, setRowMappings } from '@pothos/selection-mapper';
import type { GraphQLFieldResolver, GraphQLObjectType, GraphQLResolveInfo } from 'graphql';
import type { ModelLoader } from './model-loader.js';
import { PrismaObjectFieldBuilder as InternalPrismaObjectFieldBuilder } from './prisma-field-builder.js';
import type { IncludeMap, PrismaModelTypes } from './types.js';
import { INCLUDE_ALL, type PrismaNode, type PrismaPlan, prismaAdapter } from './util/adapter.js';
import { formatPrismaCursor, parsePrismaCursor } from './util/cursors.js';
import { getModel, getRefFromModel } from './util/datamodel.js';
import { type FallbackPlanRecipe, fallbackQueryFromInfo, queryFromInfo } from './util/map-query.js';
import type { FieldMap } from './util/relation-map.js';
import {
  fieldScopeReaders,
  hasTypeScopes,
  uncheckedReload,
  uncheckedScopesMessage,
} from './util/scope-checks.js';

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
  private typeNodes = new WeakMap<GraphQLObjectType, Map<string | undefined, TypeReloadNode>>();

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

    const config: PothosTypeConfig = {
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
    const typeKeys = typeLevelKeys(config);
    const loaderCache = config.extensions?.pothosPrismaLoader as
      | ((context: object) => ModelLoader)
      | undefined;
    const plugins: readonly string[] | undefined = this.builder.options.plugins;

    if (
      config.kind !== 'Object' ||
      !loaderCache ||
      config.extensions?.pothosPrismaFallbackDisabled ||
      typeKeys.length === 0 ||
      !plugins?.includes('scopeAuth')
    ) {
      return config;
    }

    return {
      ...config,
      extensions: {
        ...config.extensions,
        // Read by scope-auth, whose `runScopesOnType` checks run from `isTypeOf`, before any
        // field's `wrapArgMappers` can reload the row.
        pothosScopeAuthParent: this.typeParentLoader(config.name, typeKeys, loaderCache),
      },
    };
  }

  /**
   * The parent scope-auth's type checks see (a `ScopeAuthParentLoader`, which this plugin doesn't
   * import): the row itself when it has the type's `select`/`include`, else the row
   * `wrapArgMappers` reloads for the type's own fields, so the check and those fields share one
   * load.
   */
  private typeParentLoader(
    typeName: string,
    typeKeys: string[],
    loaderCache: (context: object) => ModelLoader,
  ) {
    let root: PrismaNode | undefined;

    return (parent: unknown, context: object, info: GraphQLResolveInfo): MaybePromise<unknown> => {
      const row = parent as Record<string, unknown>;

      for (const key of typeKeys) {
        if (row[key] === undefined) {
          root ??= this.typeNode(
            info.schema.getType(typeName) as GraphQLObjectType,
            undefined,
          ).root;

          return loaderCache(context).loadTypeSelection(root, row);
        }
      }

      return row;
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
   * Core runs this wrapper outside every plugin's `wrapResolve`, so a parent missing what its
   * type's `select`/`include` loads is reloaded here, before plugins listed earlier, such as
   * scope-auth, read it. Only the type-level selections are loaded, never the field's own `select`,
   * which `wrapResolve` loads for the field's resolver as it always has. A row that has them passes
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

    const { loaderCache, required, implementationKeys, parentTypes, declaringType, readers } =
      reload;
    let node: TypeReloadNode | undefined;
    let unchecked: string | undefined;

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

      if (!node) {
        node = this.typeNode(info.parentType, declaringType);
        unchecked = uncheckedReload(node.skipped, readers);
      }

      if (unchecked) {
        throw new PothosValidationError(unchecked);
      }

      return loaderCache(context)
        .loadTypeSelection(node.root, row)
        .then((loaded) => resolver(loaded, args, context, info));
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
      const mapping = findLoaderMapping(context, info, parent, parentTypes);

      if ((!loadedCheck || loadedCheck(parent, info, context)) && mapping) {
        // Against the row it resolves with: a sibling row of the same list may have been loaded
        // by another plan, and must keep answering from that one.
        setRowMappings(context, info, mapping.nested);

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

  /**
   * What `wrapArgMappers` checks a field's parent for: null when scope-auth isn't installed, the
   * field's type checks read no type-level selection, or the type opted out of fallback queries.
   */
  private typeReload(fieldConfig: PothosOutputFieldConfig<Types>) {
    const plugins: readonly string[] | undefined = this.builder.options.plugins;
    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const loaderCache = parentConfig.extensions?.pothosPrismaLoader as
      | ((context: object) => ModelLoader)
      | undefined;

    if (
      !plugins?.includes('scopeAuth') ||
      !loaderCache ||
      parentConfig.extensions?.pothosPrismaFallbackDisabled
    ) {
      return null;
    }

    // A field an interface declares is checked against the interface's type-level selection: a
    // query that reaches the implementation only through the interface doesn't plan the
    // implementation's own.
    const declaringConfig = fieldConfig.declaringType
      ? this.buildCache.getTypeConfig(fieldConfig.declaringType)
      : parentConfig;
    const required = typeLevelKeys(declaringConfig);
    // scope-auth also runs the implementing type's checks on a field an interface declares. Its
    // type-level selection is only checked on a row no plan loaded, so a planned query through
    // the interface keeps its query count.
    const implementationKeys =
      declaringConfig === parentConfig
        ? []
        : typeLevelKeys(parentConfig).filter((key) => !required.includes(key));

    if (!required.length && !implementationKeys.length) {
      return null;
    }

    return {
      loaderCache,
      required,
      implementationKeys,
      parentTypes: this.prismaParentTypes(parentConfig, fieldConfig),
      declaringType: fieldConfig.declaringType,
      // A reload that left out the selection of a type whose checks run on the field is refused.
      readers: fieldScopeReaders(
        this.buildCache,
        (this.builder.options as { scopeAuth?: { runScopesOnType?: boolean } }).scopeAuth
          ?.runScopesOnType,
        fieldConfig,
      ),
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
      const node = this.typeLevelNode(type, undefined);

      nodes = new Map([[undefined, node]]);

      for (const iface of type.getInterfaces()) {
        if (!node.skipped.has(iface.name)) {
          nodes.set(iface.name, node);
        }
      }

      this.typeNodes.set(type, nodes);
    }

    let node = nodes.get(declaringType);

    if (!node) {
      node = this.typeLevelNode(type, declaringType);
      nodes.set(declaringType, node);
    }

    return node;
  }

  /**
   * The type-level selections scope-auth's checks on a field of `type` read: the type's, then the
   * one of the interface that declares the field, then those of the other prisma interfaces `type`
   * implements, those with scope checks first, less any that conflicts with what came before
   * (`skipped`, with why its checks can't run on the row), as a row can't hold both. The type's
   * own wins, as it does on a row planned for it.
   */
  private typeLevelNode(
    type: GraphQLObjectType,
    declaringType: string | undefined,
  ): TypeReloadNode {
    const model = prismaAdapter.modelFor(type)!;
    const root = prismaAdapter.createNode(model);
    const skipped = new Map<string, string>();
    // Each merged selection on its own, to name the one a skipped selection conflicts with.
    const merged: { name: string; node: PrismaNode }[] = [];
    const others = type
      .getInterfaces()
      .filter((iface) => prismaAdapter.modelFor(iface) && iface.name !== declaringType);
    const scoped = others.filter((iface) =>
      hasTypeScopes(this.buildCache.getTypeConfig(iface.name)),
    );

    for (const merging of [
      type,
      ...type.getInterfaces().filter(({ name }) => name === declaringType),
      ...scoped,
      ...others.filter((iface) => !scoped.includes(iface)),
    ]) {
      const selection = prismaAdapter.typeSelection(merging);

      if (!selection) {
        continue;
      }

      if (prismaAdapter.canMergeQuery(root, selection)) {
        const node = prismaAdapter.createNode(model);

        prismaAdapter.mergeQuery(node, selection);
        prismaAdapter.mergeQuery(root, selection);
        merged.push({ name: merging.name, node });
      } else {
        const other = merged.find(({ node }) => !prismaAdapter.canMergeQuery(node, selection));

        skipped.set(
          merging.name,
          uncheckedScopesMessage(
            merging.name,
            type.name,
            other?.name,
            prismaAdapter.firstConflict(root, selection),
          ),
        );
      }
    }

    return { root, skipped };
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

/**
 * The node a type's rows are reloaded with, and the types whose conflicting selections it left
 * out, each with why scope-auth's checks can't run on the row for them.
 */
interface TypeReloadNode {
  root: PrismaNode;
  skipped: ReadonlyMap<string, string>;
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
