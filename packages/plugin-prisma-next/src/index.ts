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
  setRowMappings,
} from '@pothos/selection-mapper';
import {
  type GraphQLFieldResolver,
  type GraphQLIsTypeOfFn,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  type GraphQLTypeResolver,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_CONFIG,
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECTION,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_TYPE_SELECT,
  PRISMA_NEXT_TYPE_SELECTS,
} from './constants.js';
import { getPluginConfig, type PrismaNextConfig } from './utils/config.js';
import { rootModelKey } from './utils/contract.js';
import { orderableProblem, orderColumns } from './utils/cursors.js';
import { reloadFor } from './utils/errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  returnsRelationRowsAs,
} from './utils/model.js';
import {
  compileFieldSelect,
  copyIds,
  definedQuery,
  EMPTY,
  fieldCopy,
  loadsOwnTableVariantRows,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  type RawSelect,
  rowOf,
  type SplitSelect,
  splitSelect,
  type TypeSelect,
  typeCopy,
} from './utils/selections.js';
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
export type {
  PrismaNextRelationCountOptions,
  RelationCountQuery,
  RelationCountQueryLiteral,
} from './types/aggregates.js';
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
  ComputedSelectEntry,
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
    const interfaceConfigs = typeConfig.interfaces.map((iface) =>
      this.buildCache.getTypeConfig(iface, 'Interface'),
    );
    const interfaces = interfaceConfigs
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
    // Only a prisma type, which has a model of its own, has a `select`.
    const split = raw && splitSelect(raw, getModel(contract, model));
    if (split) {
      assertNoVariantRelations(split, getModel(contract, model), typeConfig.name);
      assertSelectOrders(this.config, split, getModel(contract, model));
    }
    const selects = new Map<string, TypeSelect>();
    for (const iface of interfaceConfigs) {
      for (const select of typeSelects(iface)) {
        selects.set(select.name, select);
      }
    }
    if (split) {
      selects.set(typeConfig.name, { name: typeConfig.name, ...split });
    }
    const config = {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_TYPE_SELECTS]: [...selects.values()],
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
    this.assertSelectsAgree(config);
    return config;
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
      assertSelectOrders(this.config, splitSelect(select, model), model);
    }
    const selection =
      select !== undefined
        ? compileFieldSelect(this.config.contract, select, model)
        : exposesColumn
          ? { columns: [exposed] }
          : typeSelects(this.buildCache.getTypeConfig(fieldConfig.parentType)).length
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
   * its own, as `compileFieldSelect` does for what a select function returns. A field returning an
   * object type of the relation's model plans the rows through its own selection set instead; an
   * interface's `resolveType` would read them as they load, without the base model's columns.
   * Checked on the field's final config, since a plugin that runs later, such as plugin-errors, can
   * change its type.
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
      const returnConfig = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));
      const returnModel = returnConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (
        !returnsRelationRowsAs(
          relation,
          returnConfig.kind,
          returnModel === undefined ? undefined : getModel(contract, returnModel),
        )
      ) {
        throw ownTableVariantRowsError(
          `The select of field '${fieldConfig.parentType}.${fieldConfig.name}' loads`,
          name,
          relation,
        );
      }
    }
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
   * A row of a type is copied once for the `select`s of the type and its interfaces, and holds one
   * value for each relation or computed key they write, which the fields and auth checks of all of
   * them read. So two of those `select`s that write one key must define it equally: compared with
   * `deepEqual`, so a literal compares by value and a function, anywhere in it, by identity. Two
   * selects sharing a function share it by reference rather than writing it out twice.
   */
  private assertSelectsAgree(typeConfig: PothosTypeConfig) {
    const definitions = new Map<string, { type: string; definition: unknown }>();
    for (const { name: type, relations, computed } of typeSelects(typeConfig)) {
      const check = (key: string, definition: unknown) => {
        const first = definitions.get(key);
        if (!first) {
          definitions.set(key, { type, definition });
        } else if (!deepEqual(first.definition, definition)) {
          throw new PothosSchemaError(
            `'${first.type}' and '${type}' both select '${key}', with different definitions. A row of '${typeConfig.name}' holds one value for it, which the fields and auth checks of both types read. Define it the same way in both, sharing any function such as a where or a computed value's function, or load the other version in a field's select.`,
          );
        }
      };
      for (const [name, value] of relations) {
        check(
          name,
          typeof value === 'object' ? definedQuery(value) : value === true ? undefined : value,
        );
      }
      for (const { key, relation, compute } of computed) {
        check(key, { [relation]: compute });
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
   * Resolves a field with its parent when the parent holds what the field reads: for a select
   * function, when the plan that loaded the parent included the field; for a static selection,
   * which needs no mapping, when the parent holds what it and the type's `select`s name.
   * Otherwise the loader reloads the parent with what the field needs. A field returning rows of
   * a prisma type hands each on as the copy its type's readers see.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    this.assertRowsReadable(fieldConfig);
    const gated = this.gate(resolver, fieldConfig);
    const forType = this.resultCopier(fieldConfig);
    if (!forType) {
      return gated;
    }
    return (parent, args, context, info) => copyResult(gated(parent, args, context, info), forType);
  }

  /**
   * Hands a field of a prisma type the parent it reads. A select function needs the mapping of
   * the plan that loaded the parent. A static selection needs no mapping, only a parent holding
   * the keys it and the type's `select`s name, or else the row scope-auth's checks reloaded.
   * Otherwise the loader reloads the parent with what the field needs.
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
    const { ids, keys: typeKeys } = this.typeData(fieldConfig.parentType);
    // A field with a static selection needs no mapping: it reads what its type's `select`s load
    // and what its own selection names, which any row of the type can hold. A select function
    // reads what the plan that loaded the parent planned for it.
    const columnsOnly = typeof selection !== 'function';
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    const needed = columnsOnly
      ? [
          ...typeKeys,
          ...(selection.columns ?? []),
          ...(typeof select === 'object' && select !== null
            ? selectedKeys(splitSelect(select as RawSelect, model))
            : []),
        ]
      : [];
    const parentTypes = [...mappingParentTypes(this.buildCache, fieldConfig, PRISMA_NEXT_MODEL)];
    const parentFor = (row: object, mapping: Mapping | null | undefined) =>
      mapping?.position ? fieldCopy(row, model, ids, mapping.position) : typeCopy(row, model, ids);
    const reload = (
      raw: object,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) =>
      reloadFor(info, () => config.loader(context, modelKey).loadSelection(info, raw)).then(
        (reloaded) => resolver(parentFor(reloaded.row, reloaded.mapping), args, context, info),
      );
    return (value, args, context, info) => {
      const row = value as object;
      const raw = rowOf(row);
      let mapping: Mapping | null = null;
      for (const type of parentTypes) {
        mapping = getLoaderMapping(context, info.path, type, raw);
        if (mapping) {
          break;
        }
      }
      const parent = parentFor(row, mapping);
      if ((mapping || columnsOnly) && holds(parent, needed)) {
        if (mapping) {
          setRowMappings(context, info, mapping.nested);
        }
        return resolver(parent, args, context, info);
      }
      if (!columnsOnly) {
        return reload(raw, args, context, info);
      }
      // The row scope-auth's checks reloaded, when they ran first, holds what the field reads.
      const checked = config.loader(context, modelKey).peekTypeRow(info, raw, info.parentType);
      if (!checked) {
        return reload(raw, args, context, info);
      }
      return checked.then((checkedRow) => {
        const typed = typeCopy(checkedRow, model, ids);
        return holds(typed, needed)
          ? resolver(typed, args, context, info)
          : reload(raw, args, context, info);
      });
    };
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
   * The consumer ids of a prisma type's `select`s, as `typeSelects` lists them, and what a row
   * must hold for them.
   */
  private typeData(typeName: string) {
    let data = this.typeDataCache.get(typeName);
    if (!data) {
      const typeConfig = this.buildCache.getTypeConfig(typeName);
      const modelKey = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string;
      const model = getModel(this.config.contract, modelKey);
      data = typeDataOf(modelKey, model, typeSelects(typeConfig));
      this.typeDataCache.set(typeName, data);
    }
    return data;
  }

  /**
   * The row scope-auth's checks see: the row as the `select`s of the type and its interfaces load
   * it, with the columns the field being checked reads. A row without them is reloaded with every
   * column and what those `select`s load, once per row per root field. The loader matches
   * `ScopeAuthParentLoader` in @pothos/plugin-scope-auth, which this plugin doesn't import.
   */
  private createTypeParentLoader(typeName: string) {
    let type: GraphQLObjectType | undefined;
    return (parent: unknown, context: object, info: GraphQLResolveInfo): MaybePromise<unknown> => {
      const { ids, modelKey, model, keys } = this.typeData(typeName);
      type ??= info.schema.getType(typeName) as GraphQLObjectType;
      const selection =
        info.parentType.name === typeName
          ? (info.parentType.getFields()[info.fieldName]?.extensions?.[
              PRISMA_NEXT_FIELD_SELECTION
            ] as PrismaNextSelection | PrismaNextSelectFn | undefined)
          : undefined;
      const columns = (typeof selection === 'function' ? undefined : selection?.columns) ?? [];
      // A prisma type's parent is always a row.
      const typed = typeCopy(parent as object, model, ids);
      if (holds(typed, keys) && holds(typed, columns)) {
        return typed;
      }
      return reloadFor(info, () =>
        this.config.loader(context, modelKey).loadTypeRow(info, rowOf(parent as object), type!),
      ).then((row) => typeCopy(row, model, ids));
    };
  }
}

/**
 * The `select`s of a type and of its interfaces, which `onTypeConfig` keeps to one model hierarchy.
 * The deepest interface comes first and the type itself last. None for a type without a model.
 */
function typeSelects(typeConfig: PothosTypeConfig): readonly TypeSelect[] {
  return (typeConfig.extensions?.[PRISMA_NEXT_TYPE_SELECTS] as TypeSelect[] | undefined) ?? [];
}

/** Whether none of `keys` is undefined on `row`. */
function holds(row: object, keys: readonly string[]) {
  return keys.every((key) => (row as Record<string, unknown>)[key] !== undefined);
}

/** The keys a split `select` writes on the parent: its columns, relations and computed values. */
function selectedKeys({ columns, relations, computed }: SplitSelect) {
  return [...columns, ...relations.map(([name]) => name), ...computed.map(({ key }) => key)];
}

/**
 * The keys a type-level `select` fills only from its own branch: relations it filters or refines,
 * and computed values. A whole relation reads the same whoever loaded it.
 */
function ownKeys({ relations, computed }: SplitSelect) {
  return [
    ...relations
      .filter(([, value]) => typeof value === 'function' || definedQuery(value) !== undefined)
      .map(([name]) => name),
    ...computed.map(({ key }) => key),
  ];
}

/**
 * The consumer ids of a type's type-level `selects`, listed with the deepest interface first and
 * the type itself last, and the keys a row copied for them holds.
 */
function typeDataOf(modelKey: string, model: PrismaNextModel, selects: readonly TypeSelect[]) {
  const branched = selects.filter(
    (select) => select.relations.length > 0 || select.computed.length > 0,
  );
  return {
    modelKey,
    model,
    ids: copyIds(
      branched.map((select) => select.name),
      new Map(branched.map((select) => [select.name, ownKeys(select)])),
    ),
    keys: [...new Set(selects.flatMap(selectedKeys))],
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

/**
 * A type's rows can load through the base model's collection, which can't include a relation only a
 * variant declares, so a type's `select` can't name one.
 */
function assertNoVariantRelations(
  { relations }: SplitSelect,
  model: PrismaNextModel,
  typeName: string,
) {
  for (const [name, value] of relations) {
    if (loadsOwnTableVariantRows(model.relations[name]!, value)) {
      throw ownTableVariantRowsError(
        `The select of type '${typeName}' loads`,
        name,
        model.relations[name]!,
      );
    }
  }
}

/** Checks the columns each relation entry of a static `select` orders by. */
function assertSelectOrders(
  config: PrismaNextConfig,
  { relations }: SplitSelect,
  model: PrismaNextModel,
) {
  for (const [name, value] of relations) {
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
