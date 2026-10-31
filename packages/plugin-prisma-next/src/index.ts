import './utils/plugin-conflict.js';
import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  completeValue,
  type MaybePromise,
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
  PRISMA_NEXT_DECLARED_SELECT,
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECT,
  PRISMA_NEXT_IMPLEMENTATIONS,
  PRISMA_NEXT_LOADED,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_SELECT,
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
  rowOf,
  scopeOf,
  splitSelect,
  toOneFunctionMessage,
  viewOf,
} from './utils/selections.js';
import { variantTypeNames } from './utils/variant-types.js';

export type {
  ConnectionNodeShape,
  ConnectionWrapRows,
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

/** `args` are the field's arguments before any arg mapper ran. */
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
    for (const iface of typeConfig.interfaces) {
      const ifaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const ifaceModel = ifaceConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (ifaceModel) {
        const root = model && rootModelKey(contract, model);
        if (root !== undefined && root === rootModelKey(contract, ifaceModel)) {
          // A type keeps the most specific model of its hierarchy: its own, or a variant's.
          if (model === root && ifaceModel !== root && !ownModel) {
            model = ifaceModel;
          }
          continue;
        }
        if (model && model !== ifaceModel) {
          throw new PothosSchemaError(
            `prismaObject '${typeConfig.name}' is based on model '${model}' but implements ` +
              `prismaInterface '${ifaceConfig.name}' which is based on '${ifaceModel}'. ` +
              'PrismaObjects must share a contract model with the PrismaInterfaces they extend.',
          );
        }
        model = ifaceModel;
      }
    }
    if (model === undefined) {
      return typeConfig;
    }
    // Fails the schema build for a model or contract the planner can't represent.
    assertContractModel(contract, model);
    const resolved = getModel(contract, model);
    const ownSelect = typeConfig.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;
    if (ownSelect) {
      validateStaticSelect(ownSelect, resolved, typeConfig.name);
    }
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
        // Filled once this build's schema is done; types copied from it share the registry.
        ...(typeConfig.kind === 'Interface' ? { [PRISMA_NEXT_IMPLEMENTATIONS]: new Map() } : {}),
      },
    };
  }

  /**
   * Normalizes a field's `select` (or exposed column) into the one selection the planner reads.
   * A field without one on a type with a `select` still gets an empty selection, so the plan
   * records that it loaded the type's prerequisites for the field.
   */
  override onOutputFieldConfig(
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): PothosOutputFieldConfig<Types> {
    const extensions = fieldConfig.extensions ?? {};
    // A field helper's selection: its resolver reads the slots planned for it.
    if (extensions[PRISMA_NEXT_FIELD_SELECT] !== undefined) {
      return readingOwnSlots(fieldConfig);
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
          : this.typeSelects(fieldConfig.parentType, modelName).length
            ? EMPTY
            : undefined;
    return selection
      ? {
          ...fieldConfig,
          extensions: {
            ...extensions,
            [PRISMA_NEXT_FIELD_SELECT]: selection,
            [PRISMA_NEXT_DECLARED_SELECT]: select !== undefined,
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
   * The type-level `select`s rows of `typeName` carry: those of its interfaces on the same model
   * (deepest first), then its own.
   */
  private typeSelects(typeName: string, modelName: string) {
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
      const raw = config.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;
      const model = config.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (raw && model !== undefined && rootModelKey(contract, model) === root) {
        selects.push({ name: config.name, raw });
      }
    };
    visit(this.buildCache.getTypeConfig(typeName));
    return selects;
  }

  /** Hands an object type's `isTypeOf` the row as its type loaded it. */
  override wrapIsTypeOf(
    isTypeOf: GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined,
    typeConfig: PothosObjectTypeConfig,
  ): GraphQLIsTypeOfFn<unknown, Types['Context']> | undefined {
    const scopes = isTypeOf && this.typeScopes(typeConfig);
    if (!isTypeOf || !scopes) {
      return isTypeOf;
    }
    return (parent, context, info) => isTypeOf(typeView(parent, scopes), context, info);
  }

  /** Hands an interface's `resolveType` the row as the interface loaded it. */
  override wrapResolveType(
    resolveType: GraphQLTypeResolver<unknown, Types['Context']>,
    typeConfig: PothosInterfaceTypeConfig | PothosUnionTypeConfig,
  ): GraphQLTypeResolver<unknown, Types['Context']> {
    const scopes = this.typeScopes(typeConfig);
    if (!scopes) {
      return resolveType;
    }
    return (parent, context, info, type) =>
      resolveType(typeView(parent, scopes), context, info, type);
  }

  /**
   * Hands every plugin wrapped around a field the parent the field declares: the rows and values
   * of its type's and interfaces' `select`s and of its own, reloaded first when the field needs
   * it. This hook wraps every plugin's `wrapResolve`, so their order doesn't matter.
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
      return completeValue(
        this.loadParent(reader, rowOf(parent), args, context, info),
        (loaded) => {
          loadedParents.set(info, loaded);
          return resolver(reader.declared(loaded.row, loaded.mapping), args, context, info);
        },
      );
    };
  }

  /** Hands the field's resolver the parent `wrapArgMappers` loaded, with the field's own slots. */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const reader = this.fieldReader(fieldConfig);
    if (!reader) {
      return resolver;
    }
    const readsOwnSlots = ownSlotReaders.has(fieldConfig.resolve as never);
    return (parent, args, context, info) => {
      if (parent === null || typeof parent !== 'object') {
        return resolver(parent, args, context, info);
      }
      const row = rowOf(parent);
      const known = loadedParents.get(info);
      // Another plugin may hand on a different parent.
      return completeValue(
        known?.row === row ? known : this.loadParent(reader, row, args, context, info),
        (loaded) => {
          const declared = reader.declared(loaded.row, loaded.mapping);
          if (readsOwnSlots) {
            pendingSlots.set(info, {
              parent: declared,
              view: reader.own(loaded.row, loaded.mapping),
            });
          }
          return resolver(declared, args, context, info);
        },
      );
    };
  }

  /**
   * A field resolves with its parent once the columns it reads are there and, for a planned
   * selection, the plan that loaded the parent included it; otherwise the loader reloads the
   * parent with what the field needs.
   */
  private loadParent(
    reader: FieldReader,
    row: object,
    args: object,
    context: Types['Context'],
    info: GraphQLResolveInfo,
  ): MaybePromise<LoadedParent> {
    const { modelName, columns, planned, loaded, declared, own } = reader;
    const typeRow = declared(row, null) as Record<string, unknown>;
    const missing = columns.filter((column) => typeRow[column] === undefined);
    if (!missing.length && !planned) {
      return { row, mapping: null };
    }
    assertContextObject(context, info);
    let reason: ReloadReason = 'columns';
    if (!missing.length) {
      const mapping = reader.mapping(row, context, info);
      reason = 'unplanned';
      if (mapping) {
        if (!loaded || loaded(own(row, mapping), args, context, info)) {
          setRowMappings(context, info, mapping.nested);
          return { row, mapping };
        }
        reason = 'conflict';
      }
    }
    reader.keyless ??= !getIdentityFields(this.config.contract, modelName).length;
    if (reader.keyless) {
      throw keylessReloadError(info, modelName, reason, missing);
    }
    return this.config.loader(context, modelName).loadSelection(info, row);
  }

  /**
   * The scopes of the type-level `select`s rows of a prisma type carry: those of its interfaces on
   * the same model (deepest first), then its own.
   */
  private typeScopes(typeConfig: PothosTypeConfig) {
    const modelName = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    return modelName === undefined
      ? undefined
      : this.typeSelects(typeConfig.name, modelName).map(({ name }) => name);
  }

  /** How a planned field finds and reads its parent; undefined for a field the plugin skips. */
  private fieldReader(fieldConfig: PothosOutputFieldConfig<Types>) {
    if (!fieldReaders.has(fieldConfig)) {
      fieldReaders.set(fieldConfig, this.createFieldReader(fieldConfig));
    }
    return fieldReaders.get(fieldConfig) as FieldReader | undefined;
  }

  private createFieldReader(fieldConfig: PothosOutputFieldConfig<Types>): FieldReader | undefined {
    const extensions = fieldConfig.extensions ?? {};
    const selection = extensions[PRISMA_NEXT_FIELD_SELECT] as
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
    const typeSelects = this.typeSelects(fieldConfig.parentType, modelName).map(
      ({ name, raw }) => ({ name, ...splitSelect(raw, model) }),
    );
    // The parent row carries every column and relation its type and interfaces select; one that is
    // missing reloads it. Values computed from a relation have names only the callback knows.
    const columns = [
      ...new Set([
        ...typeSelects.flatMap((own) => [
          ...own.columns,
          ...own.relations.filter(([, value]) => typeof value !== 'function').map(([name]) => name),
        ]),
        ...(typeof selection === 'function' ? [] : (selection.columns ?? [])),
      ]),
    ];
    // Each type's relation slots, the declaring type's last so its fields read what it selects.
    const typeScopes = typeSelects
      .filter((own) => own.relations.length > 0)
      .map((own) => own.name)
      .sort((a, b) => Number(a === declaring) - Number(b === declaring));
    // Fields planned on an interface are recorded there but resolve on the concrete type.
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
    const ownScope = (mapping: Mapping | null | undefined) =>
      mapping?.position && scopeOf(mapping.position);
    // A field's own `select` is part of the parent it declares; a field helper's slots are not.
    const declaresScope =
      typeof selection === 'function' && extensions[PRISMA_NEXT_DECLARED_SELECT] === true;
    // Looked up once per field execution, for `wrapArgMappers` and `wrapResolve`.
    const mappings = new WeakMap<GraphQLResolveInfo, Mapping | null>();
    return {
      modelName,
      columns,
      planned: typeof selection === 'function' || typeScopes.length > 0,
      loaded: extensions[PRISMA_NEXT_LOADED] as Loaded | undefined,
      declaresScope,
      mapping: (parent, context, info) => {
        let mapping = mappings.get(info);
        if (mapping === undefined) {
          const row = rowOf(parent);
          mapping = null;
          for (const type of parentTypes) {
            mapping ??= getLoaderMapping(context, info.path, type, row);
          }
          mappings.set(info, mapping);
        }
        return mapping;
      },
      declared: (row, mapping) =>
        viewOf(row, declaresScope ? [...typeScopes, ownScope(mapping)] : typeScopes),
      own: (row, mapping) =>
        viewOf(row, [...typeScopes, ownScope(mapping)]) as Record<string, unknown>,
    };
  }
}

interface LoadedParent {
  row: object;
  mapping: Mapping | null | undefined;
}

/** The parent `wrapArgMappers` loaded for a field execution. */
const loadedParents = new WeakMap<GraphQLResolveInfo, LoadedParent>();

interface FieldReader {
  modelName: string;
  /** Whether the model has no key to reload a row by; checked on first reload. */
  keyless?: boolean;
  columns: string[];
  planned: boolean;
  loaded: Loaded | undefined;
  /** Whether the field's own `select` is part of the parent it declares. */
  declaresScope: boolean;
  mapping(parent: object, context: object, info: GraphQLResolveInfo): Mapping | null;
  /** The parent as the field declares it, which every plugin around the field gets. */
  declared(row: object, mapping: Mapping | null | undefined): object;
  /** The parent with the field's own slots, which a field helper's resolver reads. */
  own(row: object, mapping: Mapping | null | undefined): Record<string, unknown>;
}

const fieldReaders = new WeakMap<object, FieldReader | undefined>();

function typeView(parent: unknown, scopes: readonly string[]) {
  return parent !== null && typeof parent === 'object' ? viewOf(parent, scopes) : parent;
}

/** The view a field helper's resolver reads, set by `wrapResolve` for `readingOwnSlots`. */
const pendingSlots = new WeakMap<GraphQLResolveInfo, { parent: object; view: object }>();
const ownSlotReaders = new WeakSet<GraphQLFieldResolver<unknown, unknown>>();

/**
 * A field helper's resolver (`t.relation`, counts, aggregates, connections), reading the slots
 * planned for it. The plugins wrapped around it get the parent the field declares, so per-row work
 * there (scope-auth's cached type checks) sees one object shaped like its type.
 */
function readingOwnSlots<Types extends SchemaTypes>(
  fieldConfig: PothosOutputFieldConfig<Types>,
): PothosOutputFieldConfig<Types> {
  const { resolve } = fieldConfig;
  if (!resolve || ownSlotReaders.has(resolve as never)) {
    return fieldConfig;
  }
  const reader: GraphQLFieldResolver<unknown, unknown> = (parent, args, context, info) => {
    const pending = pendingSlots.get(info);
    return resolve(
      pending && pending.parent === parent ? pending.view : parent,
      args as never,
      context as never,
      info,
    );
  };
  ownSlotReaders.add(reader);
  return { ...fieldConfig, resolve: reader as never };
}

/** What a static `select` names is checked when the schema is built, not on first use. */
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

type ReloadReason = 'columns' | 'unplanned' | 'conflict';

function keylessReloadError(
  info: GraphQLResolveInfo,
  modelName: string,
  reason: ReloadReason,
  missing: readonly string[],
) {
  const why = {
    columns: `its parent row is missing ${missing.map((column) => `'${column}'`).join(', ')}`,
    unplanned:
      'it was left out of the query that loaded its parent (its selection conflicts with another on the same parent, it is in a @defer fragment, or the parent was not loaded by a prisma field)',
    conflict:
      'its selection conflicts with another on the same parent, so it was left out of the parent query',
  }[reason];
  return new PothosValidationError(
    `Field '${info.parentType.name}.${info.fieldName}' needs its parent reloaded because ${why}, ` +
      `but model '${modelName}' has no non-null primary or unique key to reload it by. ` +
      `Add a primary or unique key to '${modelName}', or load its rows through prisma fields ` +
      'without @defer fragments or conflicting selections of the same relation.',
  );
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
