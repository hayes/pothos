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
    // Both plugins install the same prisma* builder methods; whichever loads last would win.
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
    // Scope-auth is an optional peer this plugin doesn't import.
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
   * A field with no `select` or exposed column on a type with a `select` gets an empty selection,
   * so the plan records that the type's `select` was loaded for it.
   */
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> {
    const extensions = fieldConfig.extensions ?? {};
    const own = extensions[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
    if (own !== undefined) {
      return fieldConfig;
    }
    // A field of an interface without a model resolves on the implementation's rows.
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
    // `t.expose*` accepts any key of the parent, such as a computed value, which no query can
    // select. An interface without a model only knows its own shape.
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
   * Rejects handing rows of a relation targeting a variant model to an interface that can't read
   * them. Own-table variant rows lack the base's columns (such as the discriminator); shared-table
   * ones lack its relations, which the interface's `select`s can't load for `resolveType`. Checked
   * on the final config, since a later plugin (plugin-errors) can change the field's type.
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

  private readonly selectDefinitions = new Map<
    string,
    Map<string, { type: string; definition: unknown }>
  >();

  /**
   * A row holds one value per relation the type-level `select`s write, read by every type of the
   * model, so every type-level entry of a relation, at any depth, must load alike.
   */
  private assertSelectsAgree(
    type: string,
    root: string,
    split: SplitSelect,
    refs: readonly LoadRef[],
  ) {
    const definitions =
      this.selectDefinitions.get(root) ?? this.selectDefinitions.set(root, new Map()).get(root)!;
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

  /** Prisma types take no `isTypeOf`, but plugins add one (scope-auth's `runScopesOnType`). */
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

  /** A field returning prisma rows hands each on parsed, never as the field's view. */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const modelKey = this.buildCache.getTypeConfig(fieldConfig.parentType).extensions?.[
      PRISMA_NEXT_MODEL
    ] as string | undefined;
    const { contract } = this.config;
    const model = modelKey === undefined ? undefined : getModel(contract, modelKey);
    // Checked on the final config, since a later plugin (plugin-errors) can change the type.
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
    // A connection's nodes are handed on by the edge's `node` field.
    if (!returned) {
      return gated;
    }
    const parse = (row: unknown) =>
      row !== null && typeof row === 'object' ? parseRow(baseOf(row), returned) : row;
    return (parent, args, context, info) => copyResult(gated(parent, args, context, info), parse);
  }

  /**
   * Resolves with the parsed row (or the field's view) when the parent's plan included the field
   * and the row holds what it reads. Otherwise a static selection of columns reads `typeRow`'s
   * row, and anything else reloads the parent.
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
    // A planned row holds the type's relations unless another field's rows replaced them. One
    // check per type, so rows memoise it for every field.
    const { parentType } = fieldConfig;
    const check =
      this.rowChecks.get(parentType) ??
      this.rowChecks
        .set(parentType, {
          columns: [],
          relations: rowCheck(typeSelects(this.buildCache.getTypeConfig(parentType))).relations,
        })
        .get(parentType)!;
    const columnsOnly = typeof selection !== 'function';
    const parentTypes = [...mappingParentTypes(this.buildCache, fieldConfig, PRISMA_NEXT_MODEL)];
    // A static selection's mapping has no position, and a scalar has no nested mappings.
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

  private readonly typeRows = new Map<
    string,
    (parent: unknown, context: object, info: GraphQLResolveInfo) => MaybePromise<unknown>
  >();

  /**
   * The row scope-auth's checks, `isTypeOf`, `resolveType` and a static selection's field see:
   * reloaded with what the type's `select`s load when it lacks it, once per row per root field.
   * Matches `ScopeAuthParentLoader` in @pothos/plugin-scope-auth.
   */
  private typeRow(typeName: string) {
    let loader = this.typeRows.get(typeName);
    if (!loader) {
      let check: RowCheck | undefined;
      loader = (parent, context, info) => {
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

function holdsLoad(row: object, ref: LoadRef): boolean {
  return (
    (ref.unplanned || readLoad(row, ref) !== undefined) && (!ref.count || holdsLoad(row, ref.count))
  );
}

function disagreement(first: string, type: string, key: string, model: string) {
  return new PothosSchemaError(
    `'${first}' and '${type}' both select '${key}', with different definitions. Every row of model '${model}' holds one value for it, which the fields and auth checks of every type of the model read. Define it the same way in both, or load the other version in a field's select.`,
  );
}

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
