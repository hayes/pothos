import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  completeValue,
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
  type GraphQLInterfaceType,
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
  PRISMA_NEXT_TYPE_SELECT,
  PRISMA_NEXT_TYPE_SELECTS,
} from './constants.js';
import { canInclude } from './utils/adapter.js';
import {
  checkStaticSelect,
  compileFieldSelect,
  entryDefinition,
  type RawSelect,
  type SplitSelect,
  splitSelect,
  type TypeSelect,
  typeSelects,
} from './utils/compile-select.js';
import { getPluginConfig } from './utils/config.js';
import { resolveContractModel, rootModelKey } from './utils/contract.js';
import { reloadFor } from './utils/errors.js';
import { type FieldLoads, type LoadRef, recorded, setOwnLoads } from './utils/loads.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaNextModel,
  returnsRelationRowsAs,
} from './utils/model.js';
import { refFor } from './utils/refs.js';
import {
  baseOf,
  holdsType,
  parseRow,
  type RowCheck,
  readLoad,
  rowCheck,
  sourceOf,
  viewOf,
} from './utils/rows.js';
import {
  EMPTY,
  type Narrowing,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
} from './utils/selections.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionHelperRef,
  ConnectionHelperResolveOptions,
  ConnectionHelperRow,
  PrismaNextConnectionHelperOptions,
  PrismaNextConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaNextInterfaceRef, prismaNextInterfaceBrand } from './interface-ref.js';
export { PrismaNextNodeRef, relayIDShapeBrand } from './node-ref.js';
export {
  type ModelBrand,
  type Planned,
  type PlannedRowBrand,
  PrismaNextObjectRef,
  plannedRowBrand,
  prismaNextContractBrand,
  prismaNextModelBrand,
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
  RootConnectionQueryLiteral,
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
export type {
  RelationOrderBy,
  RelationOrderSelector,
  RelationQueryOrderBy,
} from './types/order-by.js';
export type {
  PrismaNextClient,
  PrismaNextExecutionContext,
  PrismaNextPluginOptions,
  PrismaNextRequestClient,
} from './types/plugin-options.js';
export type {
  FieldQueryLiteral,
  PrismaNextRelationOptions,
  RelatedModel,
  RelationFieldShape,
  RelationOnNull,
  RelationQuery,
  RelationQueryLiteral,
  RelationWhere,
} from './types/relations.js';
export type {
  AggregateSelect,
  ConnectionPageEntry,
  NestedSelectionEntry,
  NestedSelectionFn,
  NodeSelection,
  PrismaNextSelectSpec,
  RelationSelect,
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
    const selects = new Map<string, TypeSelect>();
    for (const iface of interfaceConfigs) {
      for (const select of typeSelects(iface)) {
        selects.set(select.name, select);
      }
    }
    if (split) {
      selects.set(typeConfig.name, { name: typeConfig.name, ...split });
      // A type's rows can load through the base model's collection, which can't read the columns
      // a variant model with a table of its own inherits.
      const refs = checkStaticSelect(
        this.config,
        split,
        getModel(contract, model),
        `The select of type '${typeConfig.name}' loads`,
        () => false,
      );
      this.assertSelectsAgree(typeConfig.name, root!, split, refs);
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
          ? { pothosScopeAuthParent: this.typeRow(typeConfig.name) }
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
    const own = extensions[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
    if (own !== undefined) {
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
        ? compileFieldSelect(this.config, select, model, (type) => {
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
      ? { ...fieldConfig, extensions: { ...extensions, [PRISMA_NEXT_FIELD_SELECTION]: selection } }
      : fieldConfig;
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
    // The rows are read as the interface's `select`s and those of its interfaces load them.
    for (const { name: type, relations } of typeSelects(typeConfig)) {
      for (const [key] of relations) {
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
   * Every row of a model, across its variant models, holds one value for each relation the
   * type-level `select`s write, which the fields and auth checks of every type of the model read.
   * So two of those `select`s that write one relation must define it equally: compared as data,
   * including its nested `select`, with a `where` callback compared by identity. A relation entry
   * nested beneath one is the plain load of its model's relation too, so every type-level entry of
   * a model's relation, at any depth, must load alike.
   */
  private assertSelectsAgree(
    type: string,
    root: string,
    split: SplitSelect,
    refs: readonly LoadRef[],
  ) {
    let definitions = this.selectDefinitions.get(root);
    if (!definitions) {
      definitions = new Map();
      this.selectDefinitions.set(root, definitions);
    }
    for (const relation of split.relations) {
      const first = definitions.get(relation[0]);
      const definition = entryDefinition(relation);
      if (!first || first.type === type) {
        definitions.set(relation[0], { type, definition });
      } else if (!deepEqual(first.definition, definition)) {
        throw disagreement(first.type, type, relation[0], root);
      }
    }
    const { typeLoads } = this.config;
    const register = (on: string, refs: readonly LoadRef[]) => {
      const loads = typeLoads.get(on) ?? typeLoads.set(on, new Map()).get(on)!;
      // Only relation entries have plain loads.
      for (const { load, beneath } of refs.filter((ref) => ref.load.kind === 'rows')) {
        const first = loads.get(load.relation);
        if (!first) {
          loads.set(load.relation, { type, load });
        } else if (!deepEqual(first.load, load)) {
          throw disagreement(first.type, type, load.relation, on);
        }
        if (beneath) {
          register(beneath.model.key, beneath.refs);
        }
      }
    };
    register(root, refs);
  }

  /**
   * Passes an `isTypeOf` the row its type's checks read (see `typeRow`). Prisma types take
   * no `isTypeOf` option, but plugins add one, such as scope-auth with `runScopesOnType`.
   */
  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    if (!isTypeOf || typeConfig.extensions?.[PRISMA_NEXT_MODEL] === undefined) {
      return isTypeOf;
    }
    const load = this.typeRow(typeConfig.name);
    return (parent, context, info) =>
      completeValue(load(parent, context, info), (row) => isTypeOf(row, context, info));
  }

  /**
   * Passes `resolveType` the row the interface's checks read, reloaded when it lacks what the
   * interface's `select`s load.
   */
  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    if (typeConfig.extensions?.[PRISMA_NEXT_MODEL] === undefined) {
      return resolveType;
    }
    const load = this.typeRow(typeConfig.name);
    return (parent, context, info, type) =>
      completeValue(load(parent, context, info), (row) => resolveType(row, context, info, type));
  }

  /**
   * Resolves a field with its parent when the plan that loaded the parent included the field, or,
   * for a static selection of columns, with the row `typeRow` gives. Otherwise the loader reloads
   * the parent with what the field needs. A field returning rows of a prisma type hands each on as
   * its readers see it (see `parseRow`), never as the field's view.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const modelKey = this.buildCache.getTypeConfig(fieldConfig.parentType).extensions?.[
      PRISMA_NEXT_MODEL
    ] as string | undefined;
    const { contract } = this.config;
    const model = modelKey === undefined ? undefined : getModel(contract, modelKey);
    // Checked on the field's final config, since a plugin that runs later, such as plugin-errors,
    // can change its type, which decides the relation rows it can read.
    const returnConfig = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));
    const returnKey = returnConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const returned = returnKey === undefined ? undefined : getModel(contract, returnKey);
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    if (model && typeof select === 'object' && select !== null) {
      checkStaticSelect(
        this.config,
        splitSelect(select as RawSelect, model),
        model,
        `The select of field '${fieldConfig.parentType}.${fieldConfig.name}' loads`,
        (relation) => returnsRelationRowsAs(relation, returnConfig.kind, returned),
      );
    }
    if (model) {
      this.assertRelationRows(fieldConfig, model);
    }
    const gated = this.gate(resolver, fieldConfig, modelKey, returnConfig.kind);
    // Through lists and promises. A connection's nodes are handed on by the edge's `node` field.
    if (!returned) {
      return gated;
    }
    const parse = (row: unknown) =>
      row !== null && typeof row === 'object' ? parseRow(baseOf(row), returned) : row;
    return (parent, args, context, info) => copyResult(gated(parent, args, context, info), parse);
  }

  /**
   * Hands a field of a prisma type the parent it reads: the parsed row, or the field's view of it,
   * when the plan that loaded it planned the field and it holds what the field and the type-level
   * `select`s read. Without a plan, a static selection of columns reads the row `typeRow` gives.
   * Otherwise the loader reloads the parent with what the field needs.
   */
  private gate(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
    modelKey: string | undefined,
    returnKind: string,
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
    const check = this.rowCheckOf(fieldConfig.parentType);
    // A static selection, which names only columns, reads what its type's `select`s load and its
    // columns, which a row no plan loaded can hold. A select function reads what the plan that
    // loaded the parent planned for it.
    const columnsOnly = typeof selection !== 'function';
    const parentTypes = [...mappingParentTypes(this.buildCache, fieldConfig, PRISMA_NEXT_MODEL)];
    // A static selection's mapping has no position, and a field returning a scalar or enum has
    // no fields beneath it to record nested mappings for, so such a field looks up no mapping.
    const needsMapping = !columnsOnly || (returnKind !== 'Scalar' && returnKind !== 'Enum');
    return (value, args, context, info) => {
      const resolve = (parent: object, loads: FieldLoads | undefined) => {
        setOwnLoads(info.path, loads);
        return resolver(loads?.view ? viewOf(parent, loads) : parent, args, context, info);
      };
      const row = parseRow(baseOf(value as object), model);
      const source = sourceOf(row);
      const mapping = needsMapping
        ? parentTypes.reduce<Mapping | null>(
            (found, type) => found ?? getLoaderMapping(context, info, type, source),
            null,
          )
        : null;
      // A plan that loaded the parent planned the field into it, unless the row lacks what the
      // field or the type's `select`s read, as when it holds another field's rows.
      if (mapping && holdsType(row, check)) {
        const loads = recorded(mapping.position);
        if (!loads || loads.refs.every((ref) => holdsLoad(row, ref))) {
          setRowMappings(context, info, mapping.nested);
          return resolve(row, loads);
        }
      }
      if (columnsOnly) {
        return completeValue(this.typeRow(info.parentType.name)(row, context, info), (parent) =>
          resolver(parent as object, args, context, info),
        );
      }
      return reloadFor(info, () => config.loader(context, modelKey).loadSelection(info, row)).then(
        ({ row: loaded, mapping: reloaded }) =>
          resolve(parseRow(loaded, model), recorded(reloaded.position)),
      );
    };
  }

  private readonly rowChecks = new Map<string, RowCheck>();

  /**
   * The relations the `select`s of type `name` and its interfaces read, which a gate checks a
   * planned row holds. The plan loaded their columns, which only a row rebuilt by hand lacks.
   */
  private rowCheckOf(name: string) {
    let check = this.rowChecks.get(name);
    if (!check) {
      const { relations } = rowCheck(typeSelects(this.buildCache.getTypeConfig(name)));
      check = { columns: [], relations };
      this.rowChecks.set(name, check);
    }
    return check;
  }

  private readonly typeRows = new Map<
    string,
    (parent: unknown, context: object, info: GraphQLResolveInfo) => MaybePromise<unknown>
  >();

  /**
   * The row scope-auth's checks, `isTypeOf`, `resolveType` and a static selection's field see: the
   * row as the `select`s of the type and its interfaces load it, with the columns the field reads.
   * A row without them is reloaded with every column and what those `select`s load, once per row
   * per root field. Made once per type, and matches `ScopeAuthParentLoader` in
   * @pothos/plugin-scope-auth, which this plugin doesn't import.
   */
  private typeRow(typeName: string) {
    let loader = this.typeRows.get(typeName);
    if (!loader) {
      let check: RowCheck | undefined;
      loader = (parent, context, info) => {
        // Read from the built schema.
        const type = info.schema.getType(typeName) as GraphQLObjectType | GraphQLInterfaceType;
        const modelKey = type.extensions[PRISMA_NEXT_MODEL] as string;
        const model = getModel(this.config.contract, modelKey);
        check ??= rowCheck(typeSelects(type));
        const selection =
          info.parentType.name === typeName
            ? (info.parentType.getFields()[info.fieldName]?.extensions?.[
                PRISMA_NEXT_FIELD_SELECTION
              ] as PrismaNextSelection | PrismaNextSelectFn | undefined)
            : undefined;
        const columns = (typeof selection === 'function' ? undefined : selection?.columns) ?? [];
        // A prisma type's parent is always a row.
        const row = parseRow(baseOf(parent as object), model) as Record<string, unknown>;
        if (holdsType(row, check) && columns.every((column) => row[column] !== undefined)) {
          return row;
        }
        return reloadFor(info, () =>
          this.config.loader(context, modelKey).loadTypeRow(info, row, type),
        ).then((reloaded) => parseRow(reloaded, model));
      };
      this.typeRows.set(typeName, loader);
    }
    return loader;
  }
}

/** Whether `row`, a parsed row, holds what `ref` reads. */
function holdsLoad(row: object, ref: LoadRef): boolean {
  return (
    (ref.unplanned || readLoad(row, ref) !== undefined) && (!ref.count || holdsLoad(row, ref.count))
  );
}

/** The error for two type-level entries of `model`'s relation `key` that load it differently. */
function disagreement(first: string, type: string, key: string, model: string) {
  return new PothosSchemaError(
    `'${first}' and '${type}' both select '${key}', with different definitions. Every row of model '${model}' holds one value for it, which the fields and auth checks of every type of the model read. Define it the same way in both, or load the other version in a field's select.`,
  );
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

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
