import './utils/plugin-conflict.js';
import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type MaybePromise,
  type PothosInterfaceTypeConfig,
  type PothosObjectTypeConfig,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type PothosUnionTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import {
  deepEqual,
  getLoaderMapping,
  type Mapping,
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
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_CONFIG,
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECTION,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_LOADED_CHECK,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_REFINED_TO_ONE,
  PRISMA_NEXT_TYPE_SELECT,
} from './constants.js';
import { isLoadedTypeRow } from './model-loader.js';
import type { AnyContract } from './types/models.js';
import { getPluginConfig } from './utils/config.js';
import { rootModelKey } from './utils/contract.js';
import { reloadFor } from './utils/errors.js';
import { getModel, ownTableVariantRowsError } from './utils/model.js';
import {
  compileFieldSelect,
  definedQuery,
  EMPTY,
  type FieldSlots,
  fieldSlots,
  leftOut,
  loadedSlots,
  type PrismaNextSelectFn,
  type PrismaNextSelection,
  parentForField,
  parentForType,
  type RawSelect,
  recordFieldPosition,
  refineKeptToOne,
  rowOf,
  scopeOf,
  splitSelect,
  throwPlanningFailure,
} from './utils/selections.js';
import { assertVariantTypes } from './utils/variant-types.js';

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
} from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-field-builder.js';
export type { PrismaNextRelationCountOptions } from './types/aggregates.js';
export type { CollectionFor, PlannedCollection, ResolverCollection } from './types/collections.js';
export type {
  ConnectionOrderBy,
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
  ObjectReturnShape,
  OwnRow,
  PlannedRow,
  RelationKeys,
  Row,
} from './types/models.js';
export type {
  PrismaNextClient,
  PrismaNextExecutionContext,
  PrismaNextPluginOptions,
  PrismaNextRequestClient,
} from './types/plugin-options.js';
export type {
  PrismaNextRelationOptions,
  RelatedModel,
  RelationOrderBy,
  RelationOrderSelector,
  RelationQuery,
  RelationWhere,
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

type Loaded = (slots: FieldSlots, context: object, info: GraphQLResolveInfo) => boolean;

export class PothosPrismaNextPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  private get config() {
    return getPluginConfig(this.builder);
  }

  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }
    const { contract } = this.config;
    const ownModel = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    let model = ownModel;
    // The interface a type without its own model took its model from.
    let modelSource: string | undefined;
    for (const iface of typeConfig.interfaces) {
      const ifaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const ifaceModel = ifaceConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (ifaceModel) {
        const basis = modelSource
          ? `takes model '${model}' from prismaInterface '${modelSource}' but also implements`
          : `is based on model '${model}' but implements`;
        const root = model && rootModelKey(contract, model);
        if (root !== undefined && root === rootModelKey(contract, ifaceModel)) {
          if (ifaceModel !== root && model !== ifaceModel) {
            // A type without its own model takes the most specific one of its interfaces.
            if (model === root && !ownModel) {
              model = ifaceModel;
              modelSource = ifaceConfig.name;
              continue;
            }
            // Not every row of this type is of the interface's variant, so it can't implement the
            // interface.
            throw new PothosSchemaError(
              `'${typeConfig.name}' ${basis} prismaInterface '${ifaceConfig.name}', based on ` +
                `variant model '${ifaceModel}'. A type can only implement the prismaInterfaces ` +
                `of '${root}' and of one of its variants.`,
            );
          }
          continue;
        }
        if (model && model !== ifaceModel) {
          throw new PothosSchemaError(
            `'${typeConfig.name}' ${basis} prismaInterface '${ifaceConfig.name}', based on ` +
              `unrelated model '${ifaceModel}'. A type can only implement prismaInterfaces of ` +
              'one model hierarchy.',
          );
        }
        if (!model) {
          modelSource = ifaceConfig.name;
        }
        model = ifaceModel;
      }
    }
    if (model === undefined) {
      return typeConfig;
    }
    const raw = typeConfig.extensions?.[PRISMA_NEXT_TYPE_SELECT] as RawSelect | undefined;
    if (raw && ownModel) {
      assertNoVariantRelations(raw, ownModel, typeConfig.name, contract);
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
        // Read by scope-auth, whose `runScopesOnType` checks run from `isTypeOf`, before any
        // field reloads the row.
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
    const declaring = this.buildCache.getTypeConfig(
      fieldConfig.declaringType ?? fieldConfig.parentType,
    );
    const modelKey = declaring.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (modelKey === undefined) {
      return fieldConfig;
    }
    const { select } = fieldConfig.pothosOptions as {
      select?: Parameters<typeof compileFieldSelect>[1];
    };
    const exposed = extensions.pothosExposedField;
    const model = getModel(this.config.contract, modelKey);
    // `builder.objectField`'s `t.expose*` accepts any key of the parent, such as a computed value,
    // which no query can select as a column.
    if (select === undefined && typeof exposed === 'string' && !model.columns.has(exposed)) {
      throw new PothosSchemaError(
        `Field '${declaring.name}.${fieldConfig.name}' exposes '${exposed}', which is not a column on model ${model.key}.`,
      );
    }
    const selection =
      select !== undefined
        ? compileFieldSelect(this.config.contract, select, model)
        : typeof exposed === 'string'
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

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { contract, adapter } = this.config;
    adapter.registerImplementations(schema);
    for (const type of Object.values(schema.getTypeMap())) {
      if (isInterfaceType(type) && type.extensions?.[PRISMA_NEXT_DISCRIMINATED]) {
        assertVariantTypes(contract, schema, type);
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
   * are only known once they run, so `parentForType` checks them on the rows they loaded.
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
            `'${first.type}' and '${type}' both select relation '${relation}', with different arguments. A row of '${typeConfig.name}' holds one version of the relation, which the fields and auth checks of both types read. Select it with the same arguments in both, sharing any function such as an orderBy, or load the other version in a field, with t.relation('${relation}', { query }) or a field's select.`,
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
    const scopes = isTypeOf && this.typeLevelScopes(typeConfig);
    if (!isTypeOf || !scopes) {
      return isTypeOf;
    }
    return (parent, context, info) => isTypeOf(typeParent(parent, scopes), context, info);
  }

  /** Passes `resolveType` the row as the interface's `select`s loaded it. */
  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    const scopes = this.typeLevelScopes(typeConfig);
    if (!scopes) {
      return resolveType;
    }
    return (parent, context, info, type) =>
      resolveType(typeParent(parent, scopes), context, info, type);
  }

  /**
   * Passes every plugin's resolver wrapper the parent as the field's type sees it: what the
   * `select`s of the type and its interfaces loaded. A field's own `select` is added later, in
   * this plugin's `wrapResolve`, for its resolver only. A row without everything those `select`s
   * load, such as one another plugin rebuilt, is reloaded first, so plugins listed before this one,
   * such as scope-auth, see what the type promises.
   */
  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const reader = resolver && this.createFieldReader(fieldConfig);
    if (!resolver || !reader) {
      return resolver;
    }
    const { config } = this;
    const { modelKey, missingTypeData, staticColumns } = reader;
    // A prisma type's parent is always a row.
    return (row, args, context, info) => {
      const parent = row as object;
      const missing = missingTypeData(parent);
      if (!missing) {
        return resolver(reader.typeParent(parent), args, context, info);
      }
      // Loads the type's `select`s alone, so the field's select neither runs before the plugins
      // listed first nor takes a relation the type's select loads.
      return reloadFor(info, () =>
        config
          .loader(context, modelKey)
          .loadTypeRow(info, rowOf(parent), missing, staticColumns ?? [], info.parentType),
      ).then((loaded) => resolver(reader.typeParent(loaded), args, context, info));
    };
  }

  /**
   * Resolves a field with its parent when the parent has the columns and relations the field reads
   * and, for a planned field, the plan that loaded the parent included the field. Otherwise the
   * loader reloads the parent with what the field needs.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const reader = this.createFieldReader(fieldConfig);
    if (!reader) {
      return resolver;
    }
    const { config } = this;
    const {
      modelKey,
      requiredOnRow,
      computedRelations,
      parentScopes,
      planned,
      loaded,
      readsSlots,
      declaresOwnSelect,
      staticColumns,
    } = reader;
    const refinedToOne = fieldConfig.extensions?.[PRISMA_NEXT_REFINED_TO_ONE] as string | undefined;
    // A field helper reads its slots at the position its mapping names. A reloaded row has a
    // mapping of its own, so the position is recorded for each execution rather than looked up.
    const handOver = (
      parent: object,
      position: Position | undefined,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      if (readsSlots) {
        recordFieldPosition(info, position);
      }
      return resolver(parent, args, context, info);
    };

    return (row, args, context, info) => {
      const parent = row as object;
      // The row as every type-level select of the parent type loaded it.
      const complete = parentForType(parent, parentScopes) as Record<string, unknown>;
      const missing = requiredOnRow.filter((name) => complete[name] === undefined);
      // A row a load returned holds every scope of its type's `select`s, which is what a field
      // without a select function is planned for.
      if (
        !missing.length &&
        (!planned ||
          (staticColumns !== undefined &&
            isLoadedTypeRow(rowOf(parent)) &&
            computedRelations.every((name) => loadedSlots(parent, name))))
      ) {
        return handOver(reader.parent(parent, null), undefined, args, context, info);
      }
      const mapping = reader.mapping(parent, context, info);
      if (!missing.length) {
        const slots = mapping && fieldSlots(parent, mapping.position);
        if (
          mapping &&
          !leftOut(parent, mapping.position) &&
          computedRelations.every((name) => loadedSlots(parent, name)) &&
          (!loaded || (slots && loaded(slots, context, info))) &&
          // What a field's own `select` loaded is read from the row's slots, which a parent this
          // plugin didn't return, such as another plugin's copy, lacks.
          (!declaresOwnSelect || slots)
        ) {
          setRowMappings(context, info, mapping.nested);
          return handOver(reader.parent(parent, mapping), mapping.position, args, context, info);
        }
      }
      return reloadFor(info, () =>
        config.loader(context, modelKey).loadSelection(info, rowOf(parent), missing),
      ).then(({ row, mapping }) => {
        const position = mapping?.position;
        // The reload gives a filtered to-one relation's include to this field, whose version its
        // helper reads from a slot. Plugins see the row the field had when it holds the declared
        // relation, and otherwise the reloaded one, which holds no version of it.
        const reloaded =
          refinedToOne === undefined || missing.length
            ? reader.parent(row, mapping)
            : refineKeptToOne(
                reader.parent(parent, null),
                fieldSlots(row, position)?.rows(refinedToOne),
                position && scopeOf(position),
              );
        return handOver(reloaded, position, args, context, info);
      });
    };
  }

  /** The scopes of the `select`s `typeLevelSelects` lists for a prisma type. */
  private typeLevelScopes(typeConfig: PothosTypeConfig) {
    const modelKey = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    return modelKey === undefined
      ? undefined
      : this.typeLevelSelects(typeConfig.name).map(({ name }) => name);
  }

  /**
   * The row a type's type-level checks should see: the row as the `select`s of the type and its
   * interfaces load it. A row without everything they load, such as a copy or a variant row a
   * connection helper loaded through its own table, is reloaded, batched with the other rows of
   * the request. A complete row is returned as it is, without a promise. The loader matches
   * `ScopeAuthParentLoader` in @pothos/plugin-scope-auth, which this plugin doesn't import.
   */
  private createTypeParentLoader(typeName: string) {
    let check: TypeRowCheck | undefined;
    let type: GraphQLObjectType | undefined;
    return (parent: unknown, context: object, info: GraphQLResolveInfo): MaybePromise<unknown> => {
      check ??= this.createTypeRowCheck(typeName);
      const { modelKey, missingTypeData, typeParent } = check;
      // A prisma type's parent is always a row.
      const row = parent as object;
      const missing = missingTypeData(row);
      if (!missing) {
        return typeParent(row);
      }
      type ??= info.schema.getType(typeName) as GraphQLObjectType;
      const objectType = type;
      return reloadFor(info, () =>
        this.config
          .loader(context, modelKey)
          .loadTypeRow(info, rowOf(row), missing, [], objectType),
      ).then(typeParent);
    };
  }

  /** What `createTypeParentLoader` checks a row of `typeName` for. */
  private createTypeRowCheck(typeName: string): TypeRowCheck {
    const typeConfig = this.buildCache.getTypeConfig(typeName);
    const modelKey = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string;
    const model = getModel(this.config.contract, modelKey);
    const selects = this.typeLevelSelects(typeName).map(({ name, raw }) => ({
      name,
      ...splitSelect(raw, model),
    }));
    const { parentScopes, missingTypeData } = typeDataCheck(selects, []);
    return {
      modelKey,
      missingTypeData,
      typeParent: (row) => parentForType(row, parentScopes),
    };
  }

  /** How a planned field finds and reads its parent. Undefined for fields the plugin skips. */
  private createFieldReader(fieldConfig: PothosOutputFieldConfig<Types>): FieldReader | undefined {
    const extensions = fieldConfig.extensions ?? {};
    const selection = extensions[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextSelection
      | PrismaNextSelectFn
      | undefined;
    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const modelKey = parentConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (selection === undefined || modelKey === undefined) {
      return undefined;
    }
    const { contract } = this.config;
    const model = getModel(contract, modelKey);
    const selects = this.typeLevelSelects(fieldConfig.parentType).map(({ name, raw }) => ({
      name,
      ...splitSelect(raw, model),
    }));
    const { requiredOnRow, computedRelations, parentScopes, missingTypeData } = typeDataCheck(
      selects,
      typeof selection === 'function' ? [] : (selection.columns ?? []),
    );
    // A field planned on an interface has its mapping recorded under the interface, but it
    // resolves on the object type.
    const parentTypes = [
      fieldConfig.parentType,
      ...('interfaces' in parentConfig ? parentConfig.interfaces : [])
        .map((iface) => this.buildCache.getTypeConfig(iface, 'Interface'))
        .filter((iface) => {
          const ifaceModel = iface.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
          return (
            ifaceModel !== undefined &&
            rootModelKey(contract, ifaceModel) === rootModelKey(contract, modelKey)
          );
        })
        .map((iface) => iface.name),
    ];
    // A field's own `select` is part of the parent its resolver sees. A field helper's slots are
    // not. A static selection is only columns, so it has no slots either way.
    const declaresOwnSelect =
      typeof selection === 'function' &&
      (fieldConfig.pothosOptions as { select?: unknown }).select !== undefined;
    return {
      modelKey,
      requiredOnRow,
      computedRelations,
      planned: typeof selection === 'function' || parentScopes.length > 0,
      loaded: extensions[PRISMA_NEXT_LOADED_CHECK] as Loaded | undefined,
      declaresOwnSelect,
      readsSlots: typeof selection === 'function' && !declaresOwnSelect,
      mapping: (parent, context, info) => {
        const row = rowOf(parent);
        let mapping: Mapping | null = null;
        for (const type of parentTypes) {
          mapping ??= inheritedMapping(
            getLoaderMapping(context, info.path, type, row),
            type === fieldConfig.parentType,
            fieldConfig.pothosOptions,
          );
        }
        throwPlanningFailure(mapping?.position);
        return mapping;
      },
      parentScopes,
      staticColumns: typeof selection === 'function' ? undefined : (selection.columns ?? []),
      missingTypeData,
      typeParent: (row) => parentForType(row, parentScopes),
      parent: (row, mapping) =>
        declaresOwnSelect
          ? parentForField(row, parentScopes, mapping?.position)
          : parentForType(row, parentScopes),
    };
  }
}

interface TypeRowCheck {
  modelKey: string;
  /** What `FieldReader.missingTypeData` returns, without a field's columns. */
  missingTypeData(row: object): string[] | undefined;
  /** The row as the type's `select`s load it. */
  typeParent(row: object): object;
}

/**
 * What a row must hold for the type-level `selects` of a type, listed with the deepest interface
 * first and the type itself last, and `columns`, and the check for it.
 */
function typeDataCheck(
  selects: readonly (ReturnType<typeof splitSelect> & { name: string })[],
  columns: readonly string[],
) {
  // The parent is reloaded unless it has every column and relation its type and interfaces
  // select. Relations selected with a function aren't checked: they write computed values whose
  // keys only the function knows.
  const requiredOnRow = [
    ...new Set([
      ...selects.flatMap((select) => [
        ...select.columns,
        ...select.relations
          .filter(([, value]) => typeof value !== 'function')
          .map(([name]) => name),
      ]),
      ...columns,
    ]),
  ];
  // A function's keys aren't checked, so a relation a level can't include is checked by whether
  // its slots came back.
  const computedRelations = [
    ...new Set(
      selects.flatMap((select) =>
        select.relations.filter(([, value]) => typeof value === 'function').map(([name]) => name),
      ),
    ),
  ];
  // The scopes whose rows and values the parent shows. Every scope of the type must have loaded,
  // or the parent reloads.
  const parentScopes = selects
    .filter((select) => select.relations.length > 0)
    .map((select) => select.name);
  const missingTypeData =
    requiredOnRow.length || computedRelations.length
      ? (parent: object) => {
          const complete = parentForType(parent, parentScopes) as Record<string, unknown>;
          // Checked first so a complete row allocates nothing.
          if (
            requiredOnRow.every((name) => complete[name] !== undefined) &&
            computedRelations.every((name) => loadedSlots(parent, name))
          ) {
            return undefined;
          }
          return [
            ...requiredOnRow.filter((name) => complete[name] === undefined),
            ...computedRelations.filter((name) => !loadedSlots(parent, name)),
          ];
        }
      : () => undefined;
  return { requiredOnRow, computedRelations, parentScopes, missingTypeData };
}

interface FieldReader {
  modelKey: string;
  /** The columns and relations the parent row must hold, or it reloads. */
  requiredOnRow: string[];
  /** Scopes that must have slots on the row, or the parent reloads. */
  computedRelations: string[];
  planned: boolean;
  loaded: Loaded | undefined;
  /** Whether `parent` includes the field's own `select`. */
  declaresOwnSelect: boolean;
  /**
   * Whether the field's resolver reads the slots of a helper's selection through `fieldSlots`.
   * `t.variant` is the one such helper whose resolver doesn't.
   */
  readsSlots: boolean;
  /** The field's loader mapping. Throws what the field's select function threw, if it threw. */
  mapping(parent: object, context: object, info: GraphQLResolveInfo): Mapping | null;
  /** The type-level selects of the parent type whose loads the row is checked for. */
  parentScopes: string[];
  /**
   * The columns and relations the `select`s of the parent type and its interfaces load that `row`
   * lacks, with the columns a field without a select function reads, such as the one `t.expose*`
   * exposes, which its options see too. Undefined when it has them all.
   */
  missingTypeData(row: object): string[] | undefined;
  /** The columns a field without a select function reads, or undefined for one with one. */
  staticColumns: readonly string[] | undefined;
  /**
   * The parent plugins around the field see: the row as the `select`s of the parent type and its
   * interfaces load it. A field an interface declares sees it too: `assertSelectsAgree` keeps those
   * selects to one version of a relation's rows, and `parentForType` rejects two of them computing
   * the same key.
   */
  typeParent(row: object): object;
  /** The parent the field's resolver and the plugins listed after this one get. */
  parent(row: object, mapping: Mapping | null | undefined): object;
}

/**
 * A mapping recorded under an interface answers for an implementation only if the implementation
 * inherits the field. An override selects something else, and the interface's rows are not its own.
 */
function inheritedMapping(mapping: Mapping | null, own: boolean, definition: unknown) {
  return own ||
    !mapping?.position ||
    mapping.position.field.extensions?.pothosOptions === definition
    ? mapping
    : null;
}

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
    // A function entry computes values from the relation, rather than loading its rows.
    if (
      typeof value !== 'function' &&
      model.relations[name]!.targetVariantModel?.sharesTable === false
    ) {
      throw ownTableVariantRowsError(`type '${typeName}'`, name, model.relations[name]!);
    }
    const variant = model.relations[name]!.declaredByVariant;
    if (variant !== undefined) {
      throw new PothosSchemaError(
        `The select of type '${typeName}' includes relation '${name}', which only variant '${variant}' of model '${model.key}' declares. Rows of the type can load through '${model.key}', which can't include it. Load it in a field instead, with t.relation('${name}') or a field's select, such as t.field({ select: { ${name}: true }, ... }).`,
      );
    }
  }
}

function typeParent(parent: unknown, scopes: readonly string[]) {
  return parent !== null && typeof parent === 'object' ? parentForType(parent, scopes) : parent;
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
