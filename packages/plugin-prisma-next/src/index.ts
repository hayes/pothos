import './utils/plugin-conflict.js';
import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosInterfaceTypeConfig,
  type PothosObjectTypeConfig,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type PothosUnionTypeConfig,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import { getLoaderMapping, type Mapping, setRowMappings } from '@pothos/selection-mapper';
import {
  type GraphQLFieldResolver,
  type GraphQLIsTypeOfFn,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  type GraphQLTypeResolver,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_HAS_SELECT,
  PRISMA_NEXT_FIELD_SELECTION,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_LOADED,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_TYPE_SELECT,
} from './constants.js';
import { assertContextObject, getPluginConfig } from './utils/config.js';
import { assertContractModel, rootModelKey } from './utils/contract.js';
import { getIdentityFields, getModel, type PrismaNextModel } from './utils/model.js';
import {
  compileFieldSelect,
  EMPTY,
  type PrismaNextQuery,
  type PrismaNextSelectFn,
  type RawSelect,
  rowOfView,
  scopedView,
  scopeOf,
  splitSelect,
  toOneFunctionMessage,
} from './utils/selections.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionNodeShape,
  ConnectionWrapRows,
  HelperRef,
  PrismaConnectionHelperOptions,
  PrismaConnectionHelpers,
} from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PrismaNextInterfaceRef, prismaInterfaceKey } from './interface-ref.js';
export type { SelectObjectSpec } from './internal-types.js';
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref.js';
export {
  type ModelBrand,
  PrismaNextObjectRef,
  prismaContractKey,
  prismaModelKey,
} from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
export type {
  AnyContract,
  CollectionFor,
  ConnectionCollection,
  CursorColumn,
  CursorSpec,
  IdentityFields,
  InterfaceReturnShape,
  ModelName,
  ModelReturnShape,
  NameOrVariant,
  NoAggregateScalar,
  PrismaNextClient,
  PrismaNextConnectionFieldOptions,
  PrismaNextExecutionContext,
  PrismaNextInterfaceOptions,
  PrismaNextObjectFieldOptions,
  PrismaNextObjectOptions,
  PrismaNextPluginOptions,
  PrismaNextRelatedConnectionOptions,
  PrismaNextRelationAggregateOptions,
  PrismaNextRelationCountOptions,
  PrismaNextRelationOptions,
  PrismaNextRequestClient,
  PrismaNextRootFieldOptions,
  PrismaNextRootFieldWithInputOptions,
  PrismaNextSelectSpec,
  PrismaNextVariantFieldOptions,
  RelatedModel,
  RelationKeys,
  RelationOrderBy,
  RelationOrderSelector,
  RelationQuery,
  RelationWhere,
  ResolverCollection,
  Row,
  VariantFieldShape,
} from './types.js';

const pluginName = 'prismaNext';

export default pluginName;

type Loaded = (
  view: Record<string, unknown>,
  args: object,
  context: object,
  info: GraphQLResolveInfo,
) => boolean;

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
            // This type's rows are never of the interface's variant, so the interface could never
            // resolve to it.
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
    assertContractModel(contract, model);
    const resolved = getModel(contract, model);
    const ownSelect = typeConfig.extensions?.[PRISMA_NEXT_TYPE_SELECT] as RawSelect | undefined;
    if (ownSelect) {
      validateStaticSelect(ownSelect, resolved, typeConfig.name);
    }
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
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
    // Field helpers set their own selection, and their resolvers read the slots planned for it.
    if (extensions[PRISMA_NEXT_FIELD_SELECTION] !== undefined) {
      return readingFieldView(fieldConfig);
    }
    const declaring = this.buildCache.getTypeConfig(
      fieldConfig.declaringType ?? fieldConfig.parentType,
    );
    const modelName = declaring.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (modelName === undefined) {
      return fieldConfig;
    }
    const { select } = fieldConfig.pothosOptions as {
      select?: Parameters<typeof compileFieldSelect>[1];
    };
    const exposed = extensions.pothosExposedField;
    const model = getModel(this.config.contract, modelName);
    if (select !== undefined && typeof select !== 'function') {
      validateStaticSelect(select, model, `${declaring.name}.${fieldConfig.name}`);
    } else if (typeof exposed === 'string' && !model.columns.has(exposed)) {
      throw new PothosSchemaError(
        `Field '${declaring.name}.${fieldConfig.name}' exposes '${exposed}', which is not a column on model ${model.name}.`,
      );
    }
    const selection =
      select !== undefined
        ? compileFieldSelect(this.config.contract, select, model, declaring.name)
        : typeof exposed === 'string'
          ? { columns: [exposed] }
          : this.typeLevelSelects(fieldConfig.parentType, modelName).length
            ? EMPTY
            : undefined;
    return selection
      ? {
          ...fieldConfig,
          extensions: {
            ...extensions,
            [PRISMA_NEXT_FIELD_SELECTION]: selection,
            [PRISMA_NEXT_FIELD_HAS_SELECT]: select !== undefined,
          },
        }
      : fieldConfig;
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { contract, adapter } = this.config;
    adapter.registerImplementations(schema);
    for (const type of Object.values(schema.getTypeMap())) {
      if (isInterfaceType(type) && type.extensions?.[PRISMA_NEXT_DISCRIMINATED]) {
        variantTypeNames(contract, schema, type);
      }
      const modelName = type.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (modelName === undefined || !('getInterfaces' in type) || !type.getInterfaces().length) {
        continue;
      }
      const [iface] = adapter.conflictingInterfaces(type);
      if (iface && !getIdentityFields(contract, modelName).length) {
        throw new PothosSchemaError(
          `The select of prismaInterface '${iface}' conflicts with the select of '${type.name}', ` +
            `so its fields would always reload model '${modelName}', which has no non-null ` +
            `primary or unique key. Add a primary or unique key to '${modelName}', or make the ` +
            'selections compatible.',
        );
      }
    }
    return schema;
  }

  /**
   * The `select`s of a type and of its interfaces in the same model hierarchy. The deepest
   * interface comes first and the type itself last.
   */
  private typeLevelSelects(typeName: string, modelName: string) {
    const { contract } = this.config;
    const root = rootModelKey(contract, modelName);
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
      const model = config.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (raw && model !== undefined && rootModelKey(contract, model) === root) {
        selects.push({ name: config.name, raw });
      }
    };
    visit(this.buildCache.getTypeConfig(typeName));
    return selects;
  }

  /** Passes `isTypeOf` the row as the type's `select`s loaded it. */
  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    const scopes = isTypeOf && this.typeLevelScopes(typeConfig);
    if (!isTypeOf || !scopes) {
      return isTypeOf;
    }
    return (parent, context, info) => isTypeOf(scopedParent(parent, scopes), context, info);
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
      resolveType(scopedParent(parent, scopes), context, info, type);
  }

  /**
   * Gives the plugins that wrap a field the parent the field declares. That parent holds what the
   * `select`s of the type, its interfaces and the field itself loaded. This hook runs outside every
   * plugin's `wrapResolve`. Reloads happen in this plugin's `wrapResolve`, so plugins listed before
   * this one see the parent as it was first loaded.
   */
  override wrapArgMappers(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object> | undefined,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> | undefined {
    const reader = resolver && this.fieldReader(fieldConfig);
    if (!resolver || !reader) {
      return resolver;
    }
    return (parent, args, context, info) => {
      if (parent === null || typeof parent !== 'object') {
        return resolver(parent, args, context, info);
      }
      if (!reader.includesFieldScope) {
        return resolver(reader.declaredView(parent, null), args, context, info);
      }
      assertContextObject(context, info);
      return resolver(
        reader.declaredView(parent, reader.mapping(parent, context, info)),
        args,
        context,
        info,
      );
    };
  }

  /**
   * Resolves a field with its parent when the parent has the columns the field reads and, for a
   * planned field, the plan that loaded the parent included the field. Otherwise the loader reloads
   * the parent with what the field needs.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const reader = this.fieldReader(fieldConfig);
    if (!reader) {
      return resolver;
    }
    const { config } = this;
    const { modelName, columns, planned, loaded, declaredView, fieldView } = reader;
    const readsFieldView = fieldConfig.extensions?.[READS_FIELD_VIEW] === true;
    const handOver = (
      row: object,
      mapping: Mapping | null | undefined,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      const parent = declaredView(row, mapping);
      if (readsFieldView) {
        pendingFieldViews.set(info, { parent, view: fieldView(row, mapping) });
      }
      return resolver(parent, args, context, info);
    };

    let keyless: boolean | undefined;

    return (parent, args, context, info) => {
      if (parent === null || typeof parent !== 'object') {
        return resolver(parent, args, context, info);
      }
      const row = rowOfView(parent);
      const typeRow = declaredView(row, null) as Record<string, unknown>;
      const missing = columns.filter((column) => typeRow[column] === undefined);
      if (!missing.length && !planned) {
        return handOver(row, null, args, context, info);
      }
      assertContextObject(context, info);
      if (!missing.length) {
        const mapping = reader.mapping(row, context, info);
        if (mapping && (!loaded || loaded(fieldView(row, mapping), args, context, info))) {
          setRowMappings(context, info, mapping.nested);
          return handOver(row, mapping, args, context, info);
        }
      }
      keyless ??= !getIdentityFields(config.contract, modelName).length;
      if (keyless) {
        throw keylessReloadError(info, modelName, missing);
      }
      return config
        .loader(context, modelName)
        .loadSelection(info, row)
        .then((reloaded) => handOver(reloaded.row, reloaded.mapping, args, context, info));
    };
  }

  /** The scopes of the `select`s `typeLevelSelects` lists for a prisma type. */
  private typeLevelScopes(typeConfig: PothosTypeConfig) {
    const modelName = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    return modelName === undefined
      ? undefined
      : this.typeLevelSelects(typeConfig.name, modelName).map(({ name }) => name);
  }

  /** How a planned field finds and reads its parent. Undefined for fields the plugin skips. */
  private fieldReader(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (!fieldReaders.has(fieldConfig)) {
      fieldReaders.set(fieldConfig, this.createFieldReader(fieldConfig));
    }
    return fieldReaders.get(fieldConfig) as FieldReader | undefined;
  }

  private createFieldReader(fieldConfig: PothosOutputFieldConfig<Types>): FieldReader | undefined {
    const extensions = fieldConfig.extensions ?? {};
    const selection = extensions[PRISMA_NEXT_FIELD_SELECTION] as
      | PrismaNextQuery
      | PrismaNextSelectFn
      | undefined;
    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const modelName = parentConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (selection === undefined || modelName === undefined) {
      return undefined;
    }
    const { contract } = this.config;
    const model = getModel(contract, modelName);
    const declaring = fieldConfig.declaringType ?? fieldConfig.parentType;
    const selects = this.typeLevelSelects(fieldConfig.parentType, modelName).map(
      ({ name, raw }) => ({ name, ...splitSelect(raw, model) }),
    );
    // The parent is reloaded unless it has every column and relation its type and interfaces
    // select. Computed values are not checked because only their select callback knows their names.
    const columns = [
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
    // Scopes to merge into the parent view. The declaring type goes last so its own select wins.
    const parentScopes = selects
      .filter((select) => select.relations.length > 0)
      .map((select) => select.name)
      .sort((a, b) => Number(a === declaring) - Number(b === declaring));
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
            rootModelKey(contract, ifaceModel) === rootModelKey(contract, modelName)
          );
        })
        .map((iface) => iface.name),
    ];
    const fieldScope = (mapping: Mapping | null | undefined) =>
      mapping?.position && scopeOf(mapping.position);
    // A field's own `select` is part of the parent it declares. A field helper's slots are not.
    const includesFieldScope =
      typeof selection === 'function' && extensions[PRISMA_NEXT_FIELD_HAS_SELECT] === true;
    // Both `wrapArgMappers` and `wrapResolve` need the mapping, so it is looked up once per field
    // execution.
    const mappings = new WeakMap<GraphQLResolveInfo, Mapping | null>();
    return {
      modelName,
      columns,
      planned: typeof selection === 'function' || parentScopes.length > 0,
      loaded: extensions[PRISMA_NEXT_LOADED] as Loaded | undefined,
      includesFieldScope,
      mapping: (parent, context, info) => {
        let mapping = mappings.get(info);
        if (mapping === undefined) {
          const row = rowOfView(parent);
          mapping = null;
          for (const type of parentTypes) {
            mapping ??= getLoaderMapping(context, info.path, type, row);
          }
          mappings.set(info, mapping);
        }
        return mapping;
      },
      declaredView: (row, mapping) =>
        scopedView(row, includesFieldScope ? [...parentScopes, fieldScope(mapping)] : parentScopes),
      fieldView: (row, mapping) =>
        scopedView(row, [...parentScopes, fieldScope(mapping)]) as Record<string, unknown>,
    };
  }
}

interface FieldReader {
  modelName: string;
  columns: string[];
  planned: boolean;
  loaded: Loaded | undefined;
  /** Whether `declaredView` includes the field's scope, as it does for a field's own `select`. */
  includesFieldScope: boolean;
  mapping(parent: object, context: object, info: GraphQLResolveInfo): Mapping | null;
  /** The parent as the field declares it, which every plugin around the field gets. */
  declaredView(row: object, mapping: Mapping | null | undefined): object;
  /** The parent with the field's own slots, which a field helper's resolver reads. */
  fieldView(row: object, mapping: Mapping | null | undefined): Record<string, unknown>;
}

const fieldReaders = new WeakMap<object, FieldReader | undefined>();

function scopedParent(parent: unknown, scopes: readonly string[]) {
  return parent !== null && typeof parent === 'object' ? scopedView(parent, scopes) : parent;
}

/** The view a field helper's resolver reads, set by `wrapResolve` for `readingFieldView`. */
const pendingFieldViews = new WeakMap<GraphQLResolveInfo, { parent: object; view: object }>();
/** Marks a field whose resolver reads its own slots, even once other plugins wrap `resolve`. */
const READS_FIELD_VIEW = Symbol('pothosPrismaNextReadsFieldView');

/**
 * Makes a field helper's resolver (`t.relation`, counts, aggregates, connections) read the slots
 * planned for it. The plugins wrapped around it get the parent the field declares, so
 * per-row caches such as scope-auth's see one object shaped like the type.
 */
function readingFieldView<Types extends SchemaTypes>(
  fieldConfig: PothosOutputFieldConfig<Types>,
): PothosOutputFieldConfig<Types> {
  const { resolve } = fieldConfig;
  if (!resolve || fieldConfig.extensions?.[READS_FIELD_VIEW]) {
    return fieldConfig;
  }
  const reader: GraphQLFieldResolver<unknown, unknown> = (parent, args, context, info) => {
    const pending = pendingFieldViews.get(info);
    return resolve(
      pending && pending.parent === parent ? pending.view : parent,
      args as never,
      context as never,
      info,
    );
  };
  return {
    ...fieldConfig,
    resolve: reader as never,
    extensions: { ...fieldConfig.extensions, [READS_FIELD_VIEW]: true },
  };
}

/** Checks the names in a static `select` when the schema is built rather than on first use. */
function validateStaticSelect(raw: RawSelect, model: PrismaNextModel, owner: string) {
  const { columns, relations } = splitSelect(raw, model);
  for (const column of columns) {
    if (!model.columns.has(column)) {
      throw new PothosSchemaError(
        `select on '${owner}': '${column}' is not a column or relation on model ${model.name}.`,
      );
    }
  }
  for (const [name, value] of relations) {
    if (typeof value === 'function' && !model.relations[name]!.isToMany) {
      throw new PothosSchemaError(toOneFunctionMessage(owner, name));
    }
  }
}

function keylessReloadError(
  info: GraphQLResolveInfo,
  modelName: string,
  missing: readonly string[],
) {
  const why = missing.length
    ? `its parent row is missing ${missing.map((column) => `'${column}'`).join(', ')}`
    : 'it was left out of the query that loaded its parent (a conflicting selection, a skipped ' +
      '@defer, or a parent not loaded through a prisma field)';
  return new PothosValidationError(
    `Field '${info.parentType.name}.${info.fieldName}' needs its parent reloaded because ${why}, ` +
      `but model '${modelName}' has no non-null primary or unique key to reload it by. ` +
      `Add a primary or unique key to '${modelName}', or load its rows through prisma fields ` +
      'without @defer fragments or conflicting selections of the same relation.',
  );
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
