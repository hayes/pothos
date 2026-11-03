import './utils/plugin-conflict.js';
import './global-types.js';
import './field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosInterfaceTypeConfig,
  type PothosObjectTypeConfig,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type PothosUnionTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import {
  getLoaderMapping,
  type Mapping,
  type Position,
  setRowMappings,
} from '@pothos/selection-mapper';
import {
  type GraphQLFieldResolver,
  type GraphQLIsTypeOfFn,
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
import type { AnyContract } from './types/models.js';
import { getPluginConfig } from './utils/config.js';
import { rootModelKey } from './utils/contract.js';
import { getModel } from './utils/model.js';
import {
  compileFieldSelect,
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
  prismaContractBrand,
  prismaModelBrand,
} from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-field-builder.js';
export type { PrismaNextRelationCountOptions } from './types/aggregates.js';
export type { CollectionFor, ResolverCollection } from './types/collections.js';
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
export type { NodeSelection, PrismaNextSelectSpec, SelectObjectSpec } from './types/selections.js';
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
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
        [PRISMA_NEXT_CONFIG]: this.config,
        // Filled in afterBuild by registerImplementations.
        ...(typeConfig.kind === 'Interface' ? { [PRISMA_NEXT_IMPLEMENTATIONS]: new Map() } : {}),
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
  private typeLevelSelects(typeName: string) {
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
    visit(this.buildCache.getTypeConfig(typeName));
    return selects;
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
   * Passes every plugin's resolver wrapper the parent as the field's declaring type sees it: what
   * the `select`s of the type, its interfaces and the field loaded. Reloads happen later, in this
   * plugin's `wrapResolve`, so plugins listed before this one see the parent as first loaded.
   */
  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const reader = resolver && this.createFieldReader(fieldConfig);
    if (!resolver || !reader) {
      return resolver;
    }
    // A prisma type's parent is always a row.
    return (row, args, context, info) => {
      const parent = row as object;
      if (!reader.declaresOwnSelect) {
        return resolver(reader.parent(parent, null), args, context, info);
      }
      const mapping = reader.mapping(parent, context, info);
      return resolver(reader.parent(parent, mapping), args, context, info);
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
      if (!missing.length && !planned) {
        return handOver(reader.parent(parent, null), undefined, args, context, info);
      }
      const mapping = reader.mapping(parent, context, info);
      if (!missing.length) {
        const slots = mapping && fieldSlots(parent, mapping.position);
        if (
          mapping &&
          !leftOut(parent, mapping.position) &&
          computedRelations.every((name) => loadedSlots(parent, name)) &&
          (!loaded || (slots && loaded(slots, context, info)))
        ) {
          setRowMappings(context, info, mapping.nested);
          return handOver(reader.parent(parent, mapping), mapping.position, args, context, info);
        }
      }
      return config
        .loader(context, modelKey)
        .loadSelection(info, rowOf(parent), missing)
        .then(({ row, mapping }) => {
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
    const declaring = fieldConfig.declaringType ?? fieldConfig.parentType;
    const selects = this.typeLevelSelects(fieldConfig.parentType).map(({ name, raw }) => ({
      name,
      ...splitSelect(raw, model),
    }));
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
        ...(typeof selection === 'function' ? [] : (selection.columns ?? [])),
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
    // The scopes whose rows and values the parent shows. A field sees what the selects of the type
    // that declares it and of that type's interfaces loaded, never an implementation's version of a
    // relation. The declaring type comes after its interfaces, so its own select wins. Every scope
    // of the parent type must have loaded, or the parent reloads.
    const parentScopes = selects
      .filter((select) => select.relations.length > 0)
      .map((select) => select.name);
    const declared = new Set(this.typeLevelSelects(declaring).map(({ name }) => name));
    const declaringScopes = parentScopes.filter((scope) => declared.has(scope));
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
    // A field's own `select` is part of the parent it sees. A field helper's slots are not. A
    // static selection is only columns, so it has no slots either way.
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
      parent: (row, mapping) =>
        declaresOwnSelect
          ? parentForField(row, declaringScopes, mapping?.position)
          : parentForType(row, declaringScopes),
    };
  }
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
  /** The parent every plugin around the field and its resolver get. */
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
  for (const [name] of splitSelect(raw, model, PothosSchemaError).relations) {
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
