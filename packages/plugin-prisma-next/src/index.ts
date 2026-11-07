import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  isThenable,
  type MaybePromise,
  type OutputType,
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
  PRISMA_NEXT_RELATION_ROWS,
  PRISMA_NEXT_TYPE_NESTED,
  PRISMA_NEXT_TYPE_SELECT,
  PRISMA_NEXT_TYPE_SELECTS,
} from './constants.js';
import { canInclude } from './utils/adapter.js';
import {
  compileFieldSelect,
  definedQuery,
  isNestedSelect,
  loadsOwnTableVariantRows,
  nestedPlan,
  nestedSubject,
  type RawSelect,
  type SplitSelect,
  splitSelect,
  staticEntryVariant,
  type TypeSelect,
  typeSelects,
} from './utils/compile-select.js';
import { getPluginConfig, type PrismaNextConfig } from './utils/config.js';
import { resolveContractModel, rootModelKey } from './utils/contract.js';
import { orderableProblem, orderColumns } from './utils/cursors.js';
import { reloadFor } from './utils/errors.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  type PrismaNextRelation,
  returnsRelationRowsAs,
} from './utils/model.js';
import { refFor } from './utils/refs.js';
import { fieldCopy, type NestedPlan, rowOf, typeCopy, typeNested } from './utils/row-copies.js';
import {
  EMPTY,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
} from './utils/selections.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionHelperRef,
  ConnectionHelperRow,
  PrismaNextConnectionHelperOptions,
  PrismaNextConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaNextInterfaceRef, prismaNextInterfaceBrand } from './interface-ref.js';
export { PrismaNextNodeRef, relayIDShapeBrand } from './node-ref.js';
export {
  type ModelBrand,
  type PlannedRowBrand,
  PrismaNextObjectRef,
  plannedRowBrand,
  prismaNextContractBrand,
  prismaNextModelBrand,
  type ReturnRowsFromCollectionFromInfoOrTheParentsPlan,
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
  PrismaNextNodeOptions,
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
  LoadedRow,
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
      // A type's rows can load through the base model's collection, which can't read the columns
      // a variant model with a table of its own inherits.
      assertRelationEntries(
        this.config,
        split,
        getModel(contract, model),
        `The select of type '${typeConfig.name}' loads`,
        () => false,
      );
    }
    const selects = new Map<string, TypeSelect>();
    for (const iface of interfaceConfigs) {
      for (const select of typeSelects(iface)) {
        selects.set(select.name, select);
      }
    }
    if (split) {
      selects.set(typeConfig.name, { name: typeConfig.name, ...split });
      this.assertSelectsAgree(typeConfig.name, root!, getModel(contract, model), split);
    }
    const config = {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_TYPE_SELECTS]: [...selects.values()],
        [PRISMA_NEXT_TYPE_NESTED]: this.typeNestedOf(root),
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
    const selection =
      select !== undefined
        ? compileFieldSelect(this.config.contract, select, model, (type) => {
            // A model's name is its default ref, as for `t.prismaField`.
            const config = this.buildCache.getTypeConfig(
              typeof type === 'string' && resolveContractModel(this.config.contract, type)
                ? refFor(this.builder, type)
                : (type as OutputType<Types>),
            );
            return {
              name: config.name,
              model: config.extensions?.[PRISMA_NEXT_MODEL] as string | undefined,
            };
          })
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
   * Checks a field's static `select`: rejects a relation entry whose rows its type can't read, as
   * `assertRelationRows` explains, checks the columns its relation entries order by, and the
   * variant its type narrows their rows to. Checked on the field's final config, since a plugin
   * that runs later, such as plugin-errors, can change its type.
   */
  private assertFieldSelect(
    fieldConfig: PothosOutputFieldConfig<Types>,
    model: PrismaNextModel,
    split: SplitSelect,
  ) {
    const { contract } = this.config;
    const returnConfig = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));
    const returnModelKey = returnConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const returnModel =
      returnModelKey === undefined ? undefined : getModel(contract, returnModelKey);
    assertRelationEntries(
      this.config,
      split,
      model,
      `The select of field '${fieldConfig.parentType}.${fieldConfig.name}' loads`,
      (relation) => returnsRelationRowsAs(relation, returnConfig.kind, returnModel),
    );
    // Throws for a type of another branch of the hierarchy of a relation entry's target.
    for (const [name, value] of split.relations) {
      staticEntryVariant(
        contract,
        `Field '${fieldConfig.parentType}.${fieldConfig.name}'`,
        model.relations[name]!,
        value,
        returnModelKey,
      );
    }
  }

  /**
   * Rejects a `t.relation` or `t.relatedConnection` that hands rows of a relation targeting a
   * variant model to an interface that can't read them. Checked on the field's final config, since
   * a plugin that runs later, such as plugin-errors, can change its type.
   *
   * The rows of a variant model with a table of its own lack the base model's columns, such as the
   * discriminator an interface's `resolveType` reads, so only an object type of the relation's
   * target can take them: it plans them through its own selection set. Sharing the base's table
   * they have its columns but not its relations, which an interface's `select`s can't load for its
   * `resolveType`. An object type's fields and auth checks reload what its `select` can't load.
   */
  private assertRelationRows(fieldConfig: PothosOutputFieldConfig<Types>, model: PrismaNextModel) {
    const rows = fieldConfig.extensions?.[PRISMA_NEXT_RELATION_ROWS] as
      | { name: string; type: OutputType<Types> }
      | undefined;
    if (!rows) {
      return;
    }
    const relation = model.relations[rows.name]!;
    const target = relation.targetVariantModel;
    if (!target) {
      return;
    }
    const typeConfig = this.buildCache.getTypeConfig(rows.type);
    if (typeConfig.kind === 'Object') {
      return;
    }
    const narrowing: Narrowing = { value: target.value, throughVariantModel: true };
    const subject = `Field '${fieldConfig.parentType}.${fieldConfig.name}' returns interface '${typeConfig.name}'`;
    if (!returnsRelationRowsAs(relation, typeConfig.kind, relation.target)) {
      throw ownTableVariantRowsError(`${subject} for`, rows.name, relation);
    }
    // The rows are read as the interface's `select`s and those of its interfaces load them,
    // including a value computed over a relation.
    for (const { name: type, relations, computed } of typeSelects(typeConfig)) {
      for (const key of [...relations.map(([key]) => key), ...computed.map((c) => c.relation)]) {
        if (!canInclude(relation.target.relations[key]!, narrowing)) {
          throw new PothosSchemaError(
            `${subject}, ${type === typeConfig.name ? 'whose select' : `whose interface '${type}' has a select that`} loads base relation '${key}', for the rows of relation '${rows.name}', which targets variant model '${relation.targetModel}'. Rows loaded through a variant model can't include the base model's relations. Return them as an object type, or read '${key}' in a field.`,
          );
        }
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

  /** The first definition of each key a type-level `select` writes, by root model. */
  private readonly selectDefinitions = new Map<
    string,
    Map<string, { type: string; definition: unknown }>
  >();

  /**
   * The relation entries of type-level `select`s whose nested `select` writes branches on the
   * relation's rows, by root model.
   */
  private readonly typeNested = new Map<string, Map<string, NestedPlan>>();

  private typeNestedOf(root: string) {
    let nested = this.typeNested.get(root);
    if (!nested) {
      nested = new Map();
      this.typeNested.set(root, nested);
    }
    return nested;
  }

  /**
   * Every row of a model, across its variant models, holds one value for each relation or computed
   * key the type-level `select`s write, which the fields and auth checks of every type of the model
   * read. So two of those `select`s that write one key must define it equally: compared with
   * `deepEqual`, so a literal, including a nested `select`, compares by value and a function,
   * anywhere in it, by identity. Two selects sharing a function share it by reference rather than
   * writing it out twice.
   */
  private assertSelectsAgree(
    type: string,
    root: string,
    model: PrismaNextModel,
    split: SplitSelect,
  ) {
    const { relations, computed } = split;
    let definitions = this.selectDefinitions.get(root);
    if (!definitions) {
      definitions = new Map();
      this.selectDefinitions.set(root, definitions);
    }
    const check = (key: string, definition: unknown) => {
      const first = definitions.get(key);
      if (!first || first.type === type) {
        definitions.set(key, { type, definition });
      } else if (!deepEqual(first.definition, definition)) {
        throw new PothosSchemaError(
          `'${first.type}' and '${type}' both select '${key}', with different definitions. Every row of model '${root}' holds one value for it, which the fields and auth checks of every type of the model read. Define it the same way in both, sharing any function such as a where or a computed value's function, or load the other version in a field's select.`,
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
    for (const [name, nested] of nestedPlan(split, model) ?? []) {
      this.typeNestedOf(root).set(name, nested);
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
   * Resolves a field with its parent when the plan that loaded the parent included the field, or,
   * for a static selection of columns, when the parent holds what it and the type's `select`s
   * name. Otherwise the loader reloads the parent with what the field needs. A field returning
   * rows of a prisma type hands each on as the copy its type's readers see.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const modelKey = this.buildCache.getTypeConfig(fieldConfig.parentType).extensions?.[
      PRISMA_NEXT_MODEL
    ] as string | undefined;
    const model = modelKey === undefined ? undefined : getModel(this.config.contract, modelKey);
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    const split =
      model && typeof select === 'object' && select !== null
        ? splitSelect(select as RawSelect, model)
        : undefined;
    if (model) {
      if (split) {
        this.assertFieldSelect(fieldConfig, model, split);
      }
      this.assertRelationRows(fieldConfig, model);
    }
    const gated = this.gate(resolver, fieldConfig, modelKey);
    const forType = this.resultCopier(fieldConfig);
    if (!forType) {
      return gated;
    }
    return (parent, args, context, info) => copyResult(gated(parent, args, context, info), forType);
  }

  /**
   * Hands a field of a prisma type the parent it reads. A parent the plan that loaded it planned
   * the field for is read as it is. Without a plan, a static selection of columns reads a parent
   * holding the keys it and the type's `select`s name. Otherwise the loader reloads the parent
   * with what the field needs.
   */
  private gate(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
    modelKey: string | undefined,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const extensions = fieldConfig.extensions ?? {};
    const selection = extensions[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
    if (selection === undefined || modelKey === undefined) {
      return resolver;
    }
    const { config } = this;
    const model = getModel(config.contract, modelKey);
    const { keys: typeKeys, nested } = this.typeData(fieldConfig.parentType);
    // A static selection, which names only columns, reads what its type's `select`s load and its
    // columns, which a row no plan loaded can hold. A select function reads what the plan that
    // loaded the parent planned for it.
    const columnsOnly = typeof selection !== 'function';
    const needed = columnsOnly ? [...typeKeys, ...(selection.columns ?? [])] : [];
    const parentTypes = [...mappingParentTypes(this.buildCache, fieldConfig, PRISMA_NEXT_MODEL)];
    // A static selection's mapping has no position, and a field returning a scalar or enum has
    // no fields beneath it to record nested mappings for, so such a field looks up no mapping.
    const returnKind = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type)).kind;
    const needsMapping = !columnsOnly || (returnKind !== 'Scalar' && returnKind !== 'Enum');
    const parentFor = (row: object, mapping: Mapping | null | undefined) =>
      mapping?.position
        ? fieldCopy(row, model, nested, mapping.position)
        : typeCopy(row, model, nested);
    const reload = (
      row: object,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) =>
      reloadFor(info, () => config.loader(context, modelKey).loadSelection(info, row)).then(
        (reloaded) => resolver(parentFor(reloaded.row, reloaded.mapping), args, context, info),
      );
    return (value, args, context, info) => {
      const row = value as object;
      let mapping: Mapping | null = null;
      if (needsMapping) {
        const raw = rowOf(row);
        for (const type of parentTypes) {
          mapping = getLoaderMapping(context, info.path, type, raw);
          if (mapping) {
            break;
          }
        }
      }
      // A plan that loaded the parent planned the field into it.
      if (mapping) {
        setRowMappings(context, info, mapping.nested);
        return resolver(parentFor(row, mapping), args, context, info);
      }
      if (columnsOnly) {
        const parent = typeCopy(row, model, nested);
        if (holds(parent, needed)) {
          return resolver(parent, args, context, info);
        }
      }
      return reload(row, args, context, info);
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
    const nested = typeNested(typeConfig);
    return (row: unknown) =>
      row !== null && typeof row === 'object' ? typeCopy(row, model, nested) : row;
  }

  /** What `typeData` found for each prisma type. */
  private readonly typeDataCache = new Map<
    string,
    { modelKey: string; model: PrismaNextModel; keys: string[]; nested: NestedPlan }
  >();

  /**
   * The model of a prisma type, what a row must hold for the `select`s of the type and its
   * interfaces, and what those `select`s write on their relations' rows.
   */
  private typeData(typeName: string) {
    let data = this.typeDataCache.get(typeName);
    if (!data) {
      const typeConfig = this.buildCache.getTypeConfig(typeName);
      const modelKey = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string;
      const model = getModel(this.config.contract, modelKey);
      data = {
        modelKey,
        model,
        keys: [...new Set(typeSelects(typeConfig).flatMap(selectedKeys))],
        nested: typeNested(typeConfig),
      };
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
      const { modelKey, model, keys, nested } = this.typeData(typeName);
      type ??= info.schema.getType(typeName) as GraphQLObjectType;
      const selection =
        info.parentType.name === typeName
          ? (info.parentType.getFields()[info.fieldName]?.extensions?.[
              PRISMA_NEXT_FIELD_SELECTION
            ] as PrismaNextSelection | PrismaNextSelectFn | undefined)
          : undefined;
      const columns = (typeof selection === 'function' ? undefined : selection?.columns) ?? [];
      // A prisma type's parent is always a row.
      const typed = typeCopy(parent as object, model, nested);
      if (holds(typed, keys) && holds(typed, columns)) {
        return typed;
      }
      return reloadFor(info, () =>
        this.config.loader(context, modelKey).loadTypeRow(info, parent as object, type!),
      ).then((row) => typeCopy(row, model, nested));
    };
  }
}

/** Whether none of `keys` is undefined on `row`. */
function holds(row: object, keys: readonly string[]) {
  return keys.every((key) => (row as Record<string, unknown>)[key] !== undefined);
}

/** The keys a split `select` writes on the parent: its columns, relations and computed values. */
function selectedKeys({ columns, relations, computed }: SplitSelect) {
  return [...columns, ...relations.map(([name]) => name), ...computed.map(({ key }) => key)];
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
 * Checks the relation entries of a static `select`, which `subject` reads: rows of a variant model
 * with a table of its own load without the columns it inherits, so only a reader `readsRows` accepts
 * can take them, and the columns each entry orders by.
 */
function assertRelationEntries(
  config: PrismaNextConfig,
  { relations }: SplitSelect,
  model: PrismaNextModel,
  subject: string,
  readsRows: (relation: PrismaNextRelation) => boolean,
) {
  for (const [name, value] of relations) {
    const relation = model.relations[name]!;
    if (loadsOwnTableVariantRows(relation, value) && !readsRows(relation)) {
      throw ownTableVariantRowsError(subject, name, relation);
    }
    const query = isNestedSelect(value) ? value.query : value;
    const orderBy = typeof query === 'object' ? definedQuery(query)?.orderBy : undefined;
    if (isNestedSelect(value)) {
      // The rows of a nested `select` are read only through its parent's.
      assertRelationEntries(
        config,
        splitSelect(value.select, relation.target),
        relation.target,
        nestedSubject(subject, name),
        () => false,
      );
    }
    if (orderBy) {
      orderColumns(
        config.contract,
        relation.targetModel,
        orderBy,
        orderableProblem(config.context, relation.targetModel),
      );
    }
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
