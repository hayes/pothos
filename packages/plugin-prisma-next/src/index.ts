import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  isThenable,
  type MaybePromise,
  type PothosInterfaceTypeConfig,
  type PothosObjectTypeConfig,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type PothosUnionTypeConfig,
  type SchemaTypes,
  unwrapOutputFieldType,
} from '@pothos/core';
import {
  deepEqual,
  getLoaderMapping,
  type Mapping,
  mappingParentTypes,
  type Position,
  setRowMappings,
} from '@pothos/selection-mapper';
import {
  type GraphQLFieldResolver,
  type GraphQLIsTypeOfFn,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  type GraphQLTypeResolver,
  getNamedType,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_CONFIG,
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECTION,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_TYPE_SELECT,
} from './constants.js';
import type { AnyContract } from './types/models.js';
import { getPluginConfig, type PrismaNextConfig } from './utils/config.js';
import { rootModelKey } from './utils/contract.js';
import { orderableProblem, orderColumns } from './utils/cursors.js';
import { reloadFor } from './utils/errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
} from './utils/model.js';
import {
  compileFieldSelect,
  consumerId,
  copyIds,
  definedQuery,
  EMPTY,
  fieldCopy,
  loadedValues,
  loadsOwnTableVariantRows,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  type RawSelect,
  rowOf,
  splitSelect,
  typeCopy,
} from './utils/selections.js';
import { completeVariantRows } from './utils/variant-rows.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionHelperRow,
  HelperRef,
  PaginatedCollection,
  PrismaConnectionHelperOptions,
  PrismaConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaNextInterfaceRef, prismaInterfaceBrand } from './interface-ref.js';
export { PrismaNextNodeRef, relayIDShapeBrand } from './node-ref.js';
export {
  type ModelBrand,
  type PlannedRowBrand,
  PrismaNextObjectRef,
  plannedRowBrand,
  prismaContractBrand,
  prismaModelBrand,
  type TypeBrand,
} from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-field-builder.js';
export type { PrismaNextRelationCountOptions } from './types/aggregates.js';
export type { CollectionFor, PlannedCollection, ResolverCollection } from './types/collections.js';
export type {
  ConnectionQueryLiteral,
  PrismaNextConnectionFieldOptions,
  PrismaNextRelatedConnectionOptions,
} from './types/connections.js';
export type {
  NameOrVariant,
  PrismaNextInterfaceOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
  PrismaNextVariantFieldOptions,
  VariantFieldShape,
} from './types/fields.js';
export type {
  AnyContract,
  IdentityFields,
  InterfaceReturnShape,
  ModelKey,
  ObjectBaseShape,
  ObjectReturnShape,
  OwnRow,
  PlannedRow,
  RelationKeys,
  Row,
} from './types/models.js';
export type { RelationOrderBy } from './types/order-by.js';
export type {
  PrismaNextClient,
  PrismaNextExecutionContext,
  PrismaNextPluginOptions,
  PrismaNextRequestClient,
} from './types/plugin-options.js';
export type {
  OnNullRequired,
  PrismaNextRelationOptions,
  RelatedModel,
  RelationOnNull,
  RelationQuery,
  RelationQueryLiteral,
  RelationWhere,
  RequiresNullable,
} from './types/relations.js';
export type {
  ConnectionPageEntry,
  NodeSelection,
  PrismaNextSelectSpec,
  SelectObjectSpec,
} from './types/selections.js';
export type { ConnectionPage } from './utils/cursors.js';
export { type CollectionFromInfoOptions, collectionFromInfo } from './utils/map-query.js';

const pluginName = 'prismaNext';

export default pluginName;

export class PothosPrismaNextPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  constructor(buildCache: BuildCache<Types>, name: keyof PothosSchemaTypes.Plugins<Types>) {
    super(buildCache, name);
    // Both plugins install the same prisma* builder methods, so whichever loads last replaces the
    // other's. Core doesn't type the `plugins` registry on its default export.
    if (Object.hasOwn((SchemaBuilder as unknown as { plugins: object }).plugins, 'prisma')) {
      throw new PothosSchemaError(
        '@pothos/plugin-prisma and @pothos/plugin-prisma-next both define builder.prismaObject, ' +
          't.prismaField and the other prisma* methods, so they cannot be used in the same program.',
      );
    }
  }

  private get config() {
    return getPluginConfig(this.builder);
  }

  /**
   * Older scope-auth versions don't pass their checks what `pothosScopeAuthParent` returns, so
   * they would see rows without what the type selects.
   */
  override beforeBuild() {
    const names: readonly string[] | undefined = this.builder.options.plugins;
    if (!names?.includes('scopeAuth')) {
      return;
    }
    // Read from core's registry, since scope-auth is an optional peer this plugin doesn't import.
    // `SchemaBuilder.plugins` is a static core keeps out of its public type, hence the cast.
    const { plugins } = this.builder.constructor as unknown as {
      plugins: Record<string, { readsParentExtension?: boolean } | undefined>;
    };
    if (!plugins.scopeAuth?.readsParentExtension) {
      throw new PothosSchemaError(
        '@pothos/plugin-prisma-next requires @pothos/plugin-scope-auth 4.3.0 or newer.',
      );
    }
  }

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }
    const { contract } = this.config;
    const ownModel = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const interfaces = typeConfig.interfaces
      .map((iface) => this.buildCache.getTypeConfig(iface, 'Interface'))
      .map((iface) => ({
        name: iface.name,
        model: iface.extensions?.[PRISMA_NEXT_MODEL] as string | undefined,
      }))
      .filter((iface): iface is { name: string; model: string } => iface.model !== undefined);
    // A type without its own model takes the most specific model of its interfaces.
    const model =
      ownModel ??
      (
        interfaces.find((iface) => rootModelKey(contract, iface.model) !== iface.model) ??
        interfaces[0]
      )?.model;
    const root = model && (rootModelKey(contract, model) ?? model);
    for (const iface of interfaces) {
      if (iface.model !== model && iface.model !== root) {
        throw new PothosSchemaError(
          `'${typeConfig.name}' is of model '${model}' but implements prismaInterface '${iface.name}' of model '${iface.model}'. A type can only implement the prismaInterfaces of its model and of its model's root.`,
        );
      }
    }
    if (model === undefined) {
      return typeConfig;
    }
    const raw = typeConfig.extensions?.[PRISMA_NEXT_TYPE_SELECT] as RawSelect | undefined;
    if (raw && ownModel) {
      assertNoVariantRelations(raw, ownModel, typeConfig.name, contract);
      assertSelectOrders(this.config, raw, getModel(contract, ownModel));
    }
    this.assertSelectsAgree(typeConfig, model);
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
        [PRISMA_NEXT_CONFIG]: this.config,
        // Filled in afterBuild by registerImplementations.
        ...(typeConfig.kind === 'Interface' ? { [PRISMA_NEXT_IMPLEMENTATIONS]: new Map() } : {}),
        // Read by scope-auth, whose checks can run before this plugin's `wrapResolve` reloads the
        // row, such as from `isTypeOf` or when it is listed first.
        ...(typeConfig.kind === 'Object'
          ? { pothosScopeAuthParent: this.createTypeParentLoader(typeConfig.name) }
          : {}),
      },
    };
  }

  /**
   * Stores a field's `select`, or the column it exposes, as the selection the planner reads. A
   * field with neither on a type with a `select` gets an empty selection, so the plan records that
   * the type's `select` was loaded for it.
   */
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> {
    const extensions = fieldConfig.extensions ?? {};
    // Field helpers set their own selection.
    if (extensions[PRISMA_NEXT_FIELD_SELECTION] !== undefined) {
      return fieldConfig;
    }
    // A field an interface without a model declares still resolves on the implementation's rows,
    // so it reads them as the implementation's `select`s load them.
    const declaringConfig = this.buildCache.getTypeConfig(
      fieldConfig.declaringType ?? fieldConfig.parentType,
    );
    const modelLessInterface = !declaringConfig.extensions?.[PRISMA_NEXT_MODEL];
    const declaring = modelLessInterface
      ? this.buildCache.getTypeConfig(fieldConfig.parentType)
      : declaringConfig;
    const modelKey = declaring.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (modelKey === undefined) {
      return fieldConfig;
    }
    const { select } = fieldConfig.pothosOptions as {
      select?: Parameters<typeof compileFieldSelect>[1];
    };
    const exposed = extensions.pothosExposedField;
    const model = getModel(this.config.contract, modelKey);
    const exposesColumn = typeof exposed === 'string' && model.columns.has(exposed);
    // `builder.objectField`'s `t.expose*` accepts any key of the parent, such as a computed value,
    // which no query can select as a column. An interface without a model only knows its own shape.
    if (
      select === undefined &&
      typeof exposed === 'string' &&
      !exposesColumn &&
      !modelLessInterface
    ) {
      throw new PothosSchemaError(
        `Field '${declaring.name}.${fieldConfig.name}' exposes '${exposed}', which is not a column on model ${model.key}.`,
      );
    }
    if (select !== undefined && typeof select !== 'function') {
      assertSelectOrders(this.config, select, model);
    }
    const selection =
      select !== undefined
        ? compileFieldSelect(this.config.contract, select, model)
        : exposesColumn
          ? { columns: [exposed] }
          : this.typeLevelSelects(fieldConfig.parentType).length
            ? EMPTY
            : undefined;
    return selection
      ? {
          ...fieldConfig,
          extensions: {
            ...extensions,
            [PRISMA_NEXT_FIELD_SELECTION]: selection,
          },
        }
      : fieldConfig;
  }

  /**
   * Rejects a field's static `select` that hands the field rows of a variant model with a table of
   * its own, as `compileFieldSelect` does for what a select function returns. A field returning the
   * relation's model plans the rows through its own selection set instead. Checked on the field's
   * final config, since a plugin that runs later, such as plugin-errors, can change its type.
   */
  private assertRowsReadable(fieldConfig: PothosOutputFieldConfig<Types>) {
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    if (typeof select !== 'object' || select === null) {
      return;
    }
    const modelKey = this.buildCache.getTypeConfig(
      fieldConfig.declaringType ?? fieldConfig.parentType,
    ).extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (modelKey === undefined) {
      return;
    }
    const { contract } = this.config;
    const model = getModel(contract, modelKey);
    for (const [name, value] of splitSelect(select as RawSelect, model, PothosSchemaError)
      .relations) {
      const relation = model.relations[name]!;
      if (!loadsOwnTableVariantRows(relation, value)) {
        continue;
      }
      const returnModel = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type))
        .extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (returnModel === undefined || getModel(contract, returnModel) !== relation.target) {
        throw ownTableVariantRowsError(`field '${fieldConfig.name}'`, name, relation);
      }
    }
  }

  /**
   * The relations of a field's static `select` whose rows load through a variant model with a table
   * of its own, for a field returning an interface, whose `resolveType` reads the base model's
   * columns. A union has no model, so `assertRowsReadable` rejects one. A field returning the variant's own type reads them through the usual reload.
   */
  private variantRowCompletions(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): [string, PrismaNextRelation][] {
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    const returnKind = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type)).kind;
    const modelKey = this.buildCache.getTypeConfig(
      fieldConfig.declaringType ?? fieldConfig.parentType,
    ).extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (
      typeof select !== 'object' ||
      select === null ||
      modelKey === undefined ||
      returnKind !== 'Interface'
    ) {
      return [];
    }
    const model = getModel(this.config.contract, modelKey);
    return splitSelect(select as RawSelect, model)
      .relations.filter(([name, value]) => loadsOwnTableVariantRows(model.relations[name]!, value))
      .map(([name]) => [name, model.relations[name]!]);
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { contract, adapter } = this.config;
    adapter.registerImplementations(schema);
    for (const type of Object.values(schema.getTypeMap())) {
      if (isInterfaceType(type) && type.extensions?.[PRISMA_NEXT_DISCRIMINATED]) {
        // Throws when a variant has no implementing type, or several.
        variantTypeNames(contract, schema, type);
      }
    }
    return schema;
  }

  /**
   * The `select`s of a type and of its interfaces, which `onTypeConfig` keeps to one model
   * hierarchy. The deepest interface comes first and the type itself last.
   */
  private typeLevelSelects(type: string | PothosTypeConfig) {
    const selects: { name: string; raw: RawSelect }[] = [];
    const visited = new Set<string>();
    const visit = (config: PothosTypeConfig) => {
      if (visited.has(config.name)) {
        return;
      }
      visited.add(config.name);
      for (const iface of 'interfaces' in config ? config.interfaces : []) {
        visit(this.buildCache.getTypeConfig(iface, 'Interface'));
      }
      const raw = config.extensions?.[PRISMA_NEXT_TYPE_SELECT] as RawSelect | undefined;
      if (raw) {
        selects.push({ name: config.name, raw });
      }
    };
    visit(typeof type === 'string' ? this.buildCache.getTypeConfig(type) : type);
    return selects;
  }

  /**
   * A row holds one version of each relation the `select`s of its type and interfaces load, which
   * every reader of the row sees. So two of those `select`s that load a relation's rows must load
   * them with the same query. Function entries compute values rather than load rows, and their keys
   * are only known once they run, so the statement loading them checks them (see `assertOneWriter`).
   */
  private assertSelectsAgree(typeConfig: PothosTypeConfig, modelKey: string) {
    const model = getModel(this.config.contract, modelKey);
    const loads = new Map<string, { type: string; query: unknown }>();
    for (const { name: type, raw } of this.typeLevelSelects(typeConfig)) {
      for (const [relation, value] of splitSelect(raw, model, PothosSchemaError).relations) {
        if (typeof value === 'function') {
          continue;
        }
        const query = value === true ? undefined : definedQuery(value);
        const first = loads.get(relation);
        if (!first) {
          loads.set(relation, { type, query });
        } else if (!deepEqual(first.query, query)) {
          throw new PothosSchemaError(
            `'${first.type}' and '${type}' both select relation '${relation}', with different arguments. A row of '${typeConfig.name}' holds one version of the relation, which the fields and auth checks of both types read. Select it with the same arguments in both, sharing any function such as a where, or load the other version in a field, with t.relation('${relation}', { query }) or a field's select.`,
          );
        }
      }
    }
  }

  /**
   * Passes an `isTypeOf` the row as the type's `select`s loaded it. Prisma types take no `isTypeOf`
   * option, but plugins add one, such as scope-auth with `runScopesOnType`.
   */
  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    const forType = isTypeOf && this.typeCopier(typeConfig);
    if (!isTypeOf || !forType) {
      return isTypeOf;
    }
    return (parent, context, info) => isTypeOf(forType(parent), context, info);
  }

  /** Passes `resolveType` the row as the interface's `select`s loaded it. */
  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    const forType = this.typeCopier(typeConfig);
    if (!forType) {
      return resolveType;
    }
    return (parent, context, info, type) => resolveType(forType(parent), context, info, type);
  }

  /**
   * Resolves a planned field with its parent when the plan that loaded the parent included the
   * field and the parent holds what the field's select reads. Otherwise the loader reloads the
   * parent with what the field needs. A field returning rows of a prisma type hands each on as
   * the copy its type's readers see.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    this.assertRowsReadable(fieldConfig);
    const gated = this.gate(this.withVariantRows(resolver, fieldConfig), fieldConfig);
    const forType = this.resultCopier(fieldConfig);
    if (!forType) {
      return gated;
    }
    return (parent, args, context, info) => copyResult(gated(parent, args, context, info), forType);
  }

  /**
   * Loads the rows of a variant model with a table of its own that a field's static `select`
   * hands it, which lack the base model's columns, such as the discriminator the returned type's
   * resolveType reads. They load before the resolver runs, through the base model, as
   * `t.relation` loads them.
   */
  private withVariantRows(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const completions = this.variantRowCompletions(fieldConfig);
    if (!completions.length) {
      return resolver;
    }
    return (parent, args, context, info) => {
      const type = getNamedType(info.returnType);
      const loads = completions.map(([name, relation]) =>
        completeVariantRows(
          this.builder,
          relation,
          type,
          context,
          info,
          (parent as Record<string, unknown>)[name],
        ),
      );
      const withRows = (rows: unknown[]) =>
        resolver(
          {
            ...(parent as object),
            ...Object.fromEntries(completions.map(([name], i) => [name, rows[i]])),
          },
          args,
          context,
          info,
        );
      return loads.some(isThenable) ? Promise.all(loads).then(withRows) : withRows(loads);
    };
  }

  /**
   * Hands a field of a prisma type the parent it reads. A planned field needs the mapping of the
   * plan that loaded its parent; a field with only columns to read doesn't. Either reloads the
   * parent when a key its select reads is undefined.
   */
  private gate(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const extensions = fieldConfig.extensions ?? {};
    const selection = extensions[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
    const modelKey = this.buildCache.getTypeConfig(fieldConfig.parentType).extensions?.[
      PRISMA_NEXT_MODEL
    ] as string | undefined;
    if (selection === undefined || modelKey === undefined) {
      return resolver;
    }
    const { config } = this;
    const model = getModel(config.contract, modelKey);
    const { ids, hasTypeData } = this.typeData(fieldConfig.parentType);
    const loaded = this.loadedCheck(fieldConfig, model, hasTypeData);

    if (typeof selection !== 'function') {
      const columns = selection.columns ?? [];
      this.staticColumnsOf(fieldConfig.parentType).set(fieldConfig.name, columns);
      // Only columns to read, which any row of the type can hold, so no mapping is needed. A row
      // without them is reloaded with every column and what the type's `select`s load, which
      // scope-auth's checks share. A prisma type's parent is always a row.
      return (value, args, context, info) => {
        const parent = typeCopy(value as object, model, ids);
        if (loaded(parent, undefined)) {
          return resolver(parent, args, context, info);
        }
        return reloadFor(info, () =>
          config.loader(context, modelKey).loadTypeRow(info, rowOf(parent), info.parentType),
        ).then((row) => resolver(typeCopy(row, model, ids), args, context, info));
      };
    }
    const parentTypes = [...mappingParentTypes(this.buildCache, fieldConfig, PRISMA_NEXT_MODEL)];
    const parentFor = (row: object, mapping: Mapping | null | undefined) =>
      mapping?.position ? fieldCopy(row, model, ids, mapping.position) : typeCopy(row, model, ids);
    return (value, args, context, info) => {
      const row = value as object;
      const raw = rowOf(row);
      let mapping: Mapping | null = null;
      for (const type of parentTypes) {
        mapping ??= getLoaderMapping(context, info.path, type, raw);
      }
      const parent = parentFor(row, mapping);
      if (mapping && loaded(parent, mapping.position)) {
        setRowMappings(context, info, mapping.nested);
        return resolver(parent, args, context, info);
      }
      return reloadFor(info, () => config.loader(context, modelKey).loadSelection(info, raw)).then(
        (reloaded) => resolver(parentFor(reloaded.row, reloaded.mapping), args, context, info),
      );
    };
  }

  /**
   * Whether a field's parent holds what the field reads: what its type's `select`s load, the
   * columns and relations its static selection or `select` names, and the values each function
   * entry computed. One check, so a parent reloads at most once. A helper checks its own branch
   * when it reads it.
   */
  private loadedCheck(
    fieldConfig: PothosOutputFieldConfig<Types>,
    model: PrismaNextModel,
    hasTypeData: (parent: Record<string, unknown>) => boolean,
  ): Loaded {
    const selection = fieldConfig.extensions?.[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn;
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    const split =
      typeof select === 'object' && select !== null
        ? splitSelect(select as RawSelect, model)
        : undefined;
    const keys = [
      ...((typeof selection === 'function' ? undefined : selection.columns) ?? []),
      ...(split?.columns ?? []),
      ...(split?.relations.filter(([, value]) => typeof value !== 'function') ?? []).map(
        ([name]) => name,
      ),
    ];
    const computed = (split?.relations ?? [])
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => name);
    return (parent, position) =>
      hasTypeData(parent as Record<string, unknown>) &&
      keys.every((key) => (parent as Record<string, unknown>)[key] !== undefined) &&
      (!computed.length ||
        (!!position && computed.every((name) => loadedValues(parent, name, consumerId(position)))));
  }

  /**
   * What a field returning rows of a prisma type does to each: copies it for the type, through
   * lists and promises. Undefined for a field returning anything else. A connection's nodes are
   * copied by the edge's `node` field.
   */
  private resultCopier(fieldConfig: PothosOutputFieldConfig<Types>) {
    return this.typeCopier(this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type)));
  }

  /** Copies a row of a prisma type for the readers of the type. Undefined for any other type. */
  private typeCopier(typeConfig: PothosTypeConfig) {
    const modelKey = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (modelKey === undefined) {
      return undefined;
    }
    const model = getModel(this.config.contract, modelKey);
    const { ids } = this.typeData(typeConfig.name);
    return (row: unknown) =>
      row !== null && typeof row === 'object' ? typeCopy(row, model, ids) : row;
  }

  /** What `typeData` found for each prisma type. */
  private readonly typeDataCache = new Map<string, ReturnType<typeof typeDataOf>>();

  /**
   * The consumer ids of a prisma type's `select`s, as `typeLevelSelects` lists them, and what a row
   * must hold for them.
   */
  private typeData(typeName: string) {
    let data = this.typeDataCache.get(typeName);
    if (!data) {
      const typeConfig = this.buildCache.getTypeConfig(typeName);
      const modelKey = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string;
      const model = getModel(this.config.contract, modelKey);
      data = typeDataOf(
        modelKey,
        model,
        this.typeLevelSelects(typeName).map(({ name, raw }) => ({
          name,
          ...splitSelect(raw, model),
        })),
      );
      this.typeDataCache.set(typeName, data);
    }
    return data;
  }

  /** The columns each field with a static selection reads, by type and then field name. */
  private readonly staticColumns = new Map<string, Map<string, readonly string[]>>();

  private staticColumnsOf(typeName: string) {
    let columns = this.staticColumns.get(typeName);
    if (!columns) {
      columns = new Map();
      this.staticColumns.set(typeName, columns);
    }
    return columns;
  }

  /**
   * The row scope-auth's checks see: the row as the `select`s of the type and its interfaces load
   * it, with the columns the field being checked reads. A row without them is reloaded with every
   * column and what those `select`s load, once per row per root field. The loader matches
   * `ScopeAuthParentLoader` in @pothos/plugin-scope-auth, which this plugin doesn't import.
   */
  private createTypeParentLoader(typeName: string) {
    let type: GraphQLObjectType | undefined;
    const fieldColumns = this.staticColumnsOf(typeName);
    return (parent: unknown, context: object, info: GraphQLResolveInfo): MaybePromise<unknown> => {
      const { ids, modelKey, model, hasTypeData } = this.typeData(typeName);
      type ??= info.schema.getType(typeName) as GraphQLObjectType;
      const columns = (info.parentType.name === typeName && fieldColumns.get(info.fieldName)) || [];
      // A prisma type's parent is always a row.
      const typed = typeCopy(parent as object, model, ids) as Record<string, unknown>;
      if (hasTypeData(typed) && columns.every((column) => typed[column] !== undefined)) {
        return typed;
      }
      return reloadFor(info, () =>
        this.config.loader(context, modelKey).loadTypeRow(info, rowOf(parent as object), type!),
      ).then((row) => typeCopy(row, model, ids));
    };
  }
}

/**
 * The consumer ids of a type's type-level `selects`, listed with the deepest interface first and
 * the type itself last, and whether a row copied for them holds what they load: each column and
 * relation, and each function entry's values.
 */
function typeDataOf(
  modelKey: string,
  model: PrismaNextModel,
  selects: readonly (ReturnType<typeof splitSelect> & { name: string })[],
) {
  const required = [
    ...new Set(
      selects.flatMap((select) => [
        ...select.columns,
        ...select.relations
          .filter(([, value]) => typeof value !== 'function')
          .map(([name]) => name),
      ]),
    ),
  ];
  const computed = selects.flatMap((select) =>
    select.relations
      .filter(([, value]) => typeof value === 'function')
      .map(([name]) => [select.name, name] as const),
  );
  return {
    modelKey,
    model,
    ids: copyIds(
      selects.filter((select) => select.relations.length > 0).map((select) => select.name),
    ),
    hasTypeData: (row: Record<string, unknown>) =>
      required.every((name) => row[name] !== undefined) &&
      computed.every(([id, name]) => loadedValues(row, name, id)),
  };
}

/** `value`, a field's result, with `copy` applied to each item, through promises and lists. */
function copyResult(value: unknown, copy: (item: unknown) => unknown): unknown {
  if (value === null || typeof value !== 'object') {
    return value;
  }
  if (isThenable(value)) {
    return Promise.resolve(value).then((settled) => copyResult(settled, copy));
  }
  if (Array.isArray(value)) {
    return value.map((item: unknown) => copyResult(item, copy));
  }
  if (Symbol.asyncIterator in value) {
    return copyEach(value as AsyncIterable<unknown>, copy);
  }
  return copy(value);
}

async function* copyEach(items: AsyncIterable<unknown>, copy: (item: unknown) => unknown) {
  for await (const item of items) {
    yield copyResult(item, copy);
  }
}

/** A field's loaded check, given its parent and the position it was planned at. */
type Loaded = (parent: object, position: Position | undefined) => boolean;

/**
 * A type's rows can load through the base model's collection, which can't include a relation only a
 * variant declares, so a type's `select` can't name one.
 */
function assertNoVariantRelations(
  raw: RawSelect,
  modelKey: string,
  typeName: string,
  contract: AnyContract,
) {
  const model = getModel(contract, modelKey);
  for (const [name, value] of splitSelect(raw, model, PothosSchemaError).relations) {
    if (loadsOwnTableVariantRows(model.relations[name]!, value)) {
      throw ownTableVariantRowsError(`type '${typeName}'`, name, model.relations[name]!);
    }
  }
}

/** Checks the columns each relation entry of a static `select` orders by. */
function assertSelectOrders(config: PrismaNextConfig, raw: RawSelect, model: PrismaNextModel) {
  for (const [name, value] of splitSelect(raw, model, PothosSchemaError).relations) {
    const orderBy = typeof value === 'object' ? definedQuery(value)?.orderBy : undefined;
    if (orderBy) {
      const { targetModel } = model.relations[name]!;
      orderColumns(
        config.contract,
        targetModel,
        orderBy,
        PothosSchemaError,
        orderableProblem(config.context, targetModel),
      );
    }
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
