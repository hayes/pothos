import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type BuildCache,
  completeValue,
  isThenable,
  type MaybePromise,
  mapAsyncIterator,
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
  PRISMA_CONFIG,
  PRISMA_DISCRIMINATED,
  PRISMA_FIELD_SELECTION,
  PRISMA_IMPLEMENTATIONS,
  PRISMA_MODEL,
  PRISMA_RELATION_ROWS,
  PRISMA_TYPE_SELECT,
  PRISMA_TYPE_SELECTS,
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
import { type FieldLoads, type LoadRef, recorded, setOwnLoads } from './utils/loads.js';
import {
  getModel,
  ownTableVariantRowsError,
  type PrismaModel,
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
  type PrismaSelectFn,
  type PrismaSelection,
} from './utils/selections.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionHelperRef,
  ConnectionHelperResolveOptions,
  ConnectionHelperRow,
  PrismaConnectionHelperOptions,
  PrismaConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaInterfaceRef, prismaInterfaceBrand } from './interface-ref.js';
export { PrismaNodeRef, prismaRelayIDShapeBrand } from './node-ref.js';
export {
  type ModelBrand,
  type PlannedRowBrand,
  PrismaObjectRef,
  type PrismaPlanned,
  plannedRowBrand,
  prismaContractBrand,
  prismaModelBrand,
  type TypeBrand,
} from './object-ref.js';
export { PrismaObjectFieldBuilder } from './prisma-field-builder.js';
export type {
  PrismaRelationCountOptions,
  RelationCountQuery,
} from './types/aggregates.js';
export type {
  CollectionFor,
  PrismaPlannedCollection,
  ResolverCollection,
} from './types/collections.js';
export type {
  ConnectionQueryLiteral,
  PrismaConnectionFieldOptions,
  PrismaRelatedConnectionOptions,
  RootConnectionQueryLiteral,
} from './types/connections.js';
export type {
  PrismaInterfaceOptions,
  PrismaNodeOptions,
  PrismaObjectFieldOptions,
  PrismaObjectOptions,
  PrismaRootFieldOptions,
  PrismaRootFieldWithInputOptions,
  PrismaVariantFieldOptions,
  VariantFieldShape,
} from './types/fields.js';
export type {
  AnyContract,
  IdentityFields,
  LoadedRow,
  ModelKey,
  ObjectBaseShape,
  OwnRow,
  PlannedRow,
  RelationKeys,
  Row,
} from './types/models.js';
export type { RelationOrderBy } from './types/order-by.js';
export type {
  PrismaClient,
  PrismaExecutionContext,
  PrismaPluginOptions,
  PrismaRequestClient,
} from './types/plugin-options.js';
export type {
  FieldQueryLiteral,
  PrismaRelationOptions,
  RelatedModel,
  RelationFieldShape,
  RelationQuery,
  RelationQueryLiteral,
  RelationWhere,
} from './types/relations.js';
export type {
  ConnectionPageEntry,
  NestedSelectionEntry,
  NestedSelectionFn,
  NodeSelection,
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
    const ownModel = typeConfig.extensions?.[PRISMA_MODEL] as string | undefined;
    const interfaceConfigs = typeConfig.interfaces.map((iface) =>
      this.buildCache.getTypeConfig(iface, 'Interface'),
    );
    const interfaces = interfaceConfigs
      .map((iface) => ({
        name: iface.name,
        model: iface.extensions?.[PRISMA_MODEL] as string | undefined,
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
    const raw = typeConfig.extensions?.[PRISMA_TYPE_SELECT] as RawSelect | undefined;
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
        `Type '${typeConfig.name}' select`,
        () => false,
      );
      this.assertSelectsAgree(typeConfig.name, root!, split, refs);
    }
    const config = {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_TYPE_SELECTS]: [...selects.values()],
        [PRISMA_MODEL]: model,
        [PRISMA_CONFIG]: this.config,
        ...(typeConfig.kind === 'Interface' ? { [PRISMA_IMPLEMENTATIONS]: new Map() } : {}),
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
    const own = extensions[PRISMA_FIELD_SELECTION] as PrismaSelection | PrismaSelectFn | undefined;
    if (own !== undefined) {
      return fieldConfig;
    }
    // A field of an interface without a model resolves on the implementation's rows.
    const declaringConfig = this.buildCache.getTypeConfig(
      fieldConfig.declaringType ?? fieldConfig.parentType,
    );
    const modelLessInterface = !declaringConfig.extensions?.[PRISMA_MODEL];
    const declaring = modelLessInterface
      ? this.buildCache.getTypeConfig(fieldConfig.parentType)
      : declaringConfig;
    const modelKey = declaring.extensions?.[PRISMA_MODEL] as string | undefined;
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
              model: config.extensions?.[PRISMA_MODEL] as string | undefined,
            };
          })
        : exposesColumn
          ? { columns: [exposed] }
          : typeSelects(this.buildCache.getTypeConfig(fieldConfig.parentType)).length
            ? EMPTY
            : undefined;
    return selection
      ? { ...fieldConfig, extensions: { ...extensions, [PRISMA_FIELD_SELECTION]: selection } }
      : fieldConfig;
  }

  /**
   * Model-backed interfaces hydrate missing variant prerequisites before resolving their type.
   * Other abstract readers cannot hydrate those rows. Check the registered output config here.
   */
  private assertRelationRows(fieldConfig: PothosOutputFieldConfig<Types>, model: PrismaModel) {
    const rows = fieldConfig.extensions?.[PRISMA_RELATION_ROWS] as
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
    const key = typeConfig.extensions?.[PRISMA_MODEL] as string | undefined;
    if (
      typeConfig.kind === 'Object' ||
      (typeConfig.kind === 'Interface' &&
        key !== undefined &&
        getModel(this.config.contract, key) === relation.target)
    ) {
      return;
    }
    const narrowing: Narrowing = { value: target.value, throughVariantModel: true };
    const subject = `Field '${fieldConfig.parentType}.${fieldConfig.name}' returns interface '${typeConfig.name}'`;
    if (
      !returnsRelationRowsAs(
        relation,
        typeConfig.kind,
        key === undefined ? undefined : getModel(this.config.contract, key),
      )
    ) {
      throw ownTableVariantRowsError(subject, rows.name, relation);
    }
    for (const { name: type, relations } of typeSelects(typeConfig)) {
      for (const { name: key } of relations) {
        if (!canInclude(relation.target.relations[key]!, narrowing)) {
          throw new PothosSchemaError(
            `${subject}: relation '${rows.name}' targets '${relation.targetModel}' and cannot load base relation '${type}.${key}'. Move '${key}' to a field select.`,
          );
        }
      }
    }
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { contract, adapter } = this.config;
    adapter.registerImplementations(schema);
    for (const type of Object.values(schema.getTypeMap())) {
      if (isInterfaceType(type) && type.extensions?.[PRISMA_DISCRIMINATED]) {
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
      const first = definitions.get(relation.name);
      const definition = entryDefinition(relation);
      if (!first || first.type === type) {
        definitions.set(relation.name, { type, definition });
      } else if (!deepEqual(first.definition, definition)) {
        throw disagreement(first.type, type, relation.name, root);
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
    if (!isTypeOf || typeConfig.extensions?.[PRISMA_MODEL] === undefined) {
      return isTypeOf;
    }
    const load = this.typeRow(typeConfig.name, true);
    return (parent, context, info) =>
      completeValue(load(parent, context, info), (row) => isTypeOf(row, context, info));
  }

  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    if (typeConfig.extensions?.[PRISMA_MODEL] === undefined) {
      return resolveType;
    }
    const load = this.typeRow(typeConfig.name, true);
    return (parent, context, info, type) =>
      completeValue(load(parent, context, info), (row) => resolveType(row, context, info, type));
  }

  /** A field returning prisma rows hands each on parsed, never as the field's view. */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const modelKey = this.buildCache.getTypeConfig(fieldConfig.parentType).extensions?.[
      PRISMA_MODEL
    ] as string | undefined;
    const { contract } = this.config;
    const model = modelKey === undefined ? undefined : getModel(contract, modelKey);
    // Checked on the final config, since a later plugin (plugin-errors) can change the type.
    const returnConfig = this.buildCache.getTypeConfig(unwrapOutputFieldType(fieldConfig.type));
    const returnKey = returnConfig.extensions?.[PRISMA_MODEL] as string | undefined;
    const returned = returnKey === undefined ? undefined : getModel(contract, returnKey);
    const { select } = fieldConfig.pothosOptions as { select?: unknown };
    if (model && typeof select === 'object' && select !== null) {
      checkStaticSelect(
        this.config,
        splitSelect(select as RawSelect, model),
        model,
        `Field '${fieldConfig.parentType}.${fieldConfig.name}' select`,
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
    const selection = extensions[PRISMA_FIELD_SELECTION] as
      | PrismaSelection
      | PrismaSelectFn
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
    const parentTypes = [...mappingParentTypes(this.buildCache, fieldConfig, PRISMA_MODEL)];
    // A static selection's mapping has no position, and a scalar has no nested mappings.
    const needsMapping = !columnsOnly || (returnKind !== 'Scalar' && returnKind !== 'Enum');
    const resolve = (
      parent: object,
      loads: FieldLoads | undefined,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      if (!loads) {
        return resolver(parent, args, context, info);
      }
      setOwnLoads(info.path, loads);
      return resolver(loads.view ? viewOf(parent, loads) : parent, args, context, info);
    };
    return (value, args, context, info) => {
      if (needsMapping) {
        const row = parseRow(baseOf(value as object), model);
        const source = sourceOf(row);
        let mapping: Mapping | null = null;
        for (const type of parentTypes) {
          mapping ??= getLoaderMapping(context, info, type, source);
        }
        if (mapping && holdsType(row, check)) {
          const loads = recorded(mapping.position);
          if (!loads || holdsLoads(row, loads)) {
            setRowMappings(context, info, mapping.nested);
            return resolve(row, loads, args, context, info);
          }
        }
        if (!columnsOnly) {
          return config
            .loader(context, modelKey)
            .loadSelection(info, row)
            .then(({ row: loaded, mapping: reloaded }) =>
              resolve(parseRow(loaded, model), recorded(reloaded.position), args, context, info),
            );
        }
      }
      return completeValue(this.typeRow(info.parentType.name)(value, context, info), (parent) =>
        resolver(parent as object, args, context, info),
      );
    };
  }

  private readonly rowChecks = new Map<string, RowCheck>();

  private readonly typeRows = new Map<
    string,
    (parent: unknown, context: object, info: GraphQLResolveInfo) => MaybePromise<unknown>
  >();

  /**
   * The row scope-auth's checks and a static selection's field see, or with `toOne` the columns and
   * to-one relations `isTypeOf` and `resolveType` are typed with: reloaded with what the type's
   * `select`s load when it lacks it, once per row per root field. Matches `ScopeAuthParentLoader`.
   */
  private typeRow(typeName: string, toOne = false) {
    const key = toOne ? `${typeName} to-one` : typeName;
    let loader = this.typeRows.get(key);
    if (!loader) {
      const init = (schema: GraphQLSchema) => {
        const type = schema.getType(typeName) as GraphQLObjectType | GraphQLInterfaceType;
        const modelKey = type.extensions[PRISMA_MODEL] as string;
        const model = getModel(this.config.contract, modelKey);
        const check = rowCheck(typeSelects(type), toOne ? model : undefined);
        return { type, modelKey, model, check };
      };
      let read: ReturnType<typeof init> | undefined;
      loader = (parent, context, info) => {
        read ??= init(info.schema);
        const { type, modelKey, model, check } = read;
        const selection =
          info.parentType.name === typeName
            ? (info.parentType.getFields()[info.fieldName]?.extensions?.[PRISMA_FIELD_SELECTION] as
                | PrismaSelection
                | PrismaSelectFn
                | undefined)
            : undefined;
        const columns = (typeof selection === 'function' ? undefined : selection?.columns) ?? [];
        const row = parseRow(baseOf(parent as object), model) as Record<string, unknown>;
        if (holdsType(row, check) && columns.every((column) => row[column] !== undefined)) {
          return row;
        }
        return this.config
          .loader(context, modelKey)
          .loadTypeRow(info, row, type)
          .then((reloaded) => parseRow(reloaded, model));
      };
      this.typeRows.set(key, loader);
    }
    return loader;
  }
}

function holdsLoads(row: object, { refs }: FieldLoads): boolean {
  for (const ref of refs) {
    if (!holdsLoad(row, ref)) {
      return false;
    }
  }
  return true;
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
    return {
      [Symbol.asyncIterator]: () =>
        mapAsyncIterator((value as AsyncIterable<unknown>)[Symbol.asyncIterator](), (item) =>
          copyResult(item, copy),
        ),
    };
  }
  return copy(value);
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
