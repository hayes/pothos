import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  PothosValidationError,
  type SchemaTypes,
} from '@pothos/core';
import {
  getLoaderMapping,
  type IndirectInclude,
  type Mapping,
  setRowMappings,
} from '@pothos/selection-mapper';
import {
  type GraphQLFieldResolver,
  type GraphQLResolveInfo,
  type GraphQLSchema,
  isInterfaceType,
} from 'graphql';
import {
  PRISMA_NEXT_DISCRIMINATED,
  PRISMA_NEXT_FIELD_SELECT,
  PRISMA_NEXT_LOADED,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_SELECT,
} from './constants.js';
import { assertContextObject, getPluginConfig } from './utils/config.js';
import { assertContractModel, rootModelKey } from './utils/contract.js';
import { getIdentityFields, getModel, type PrismaNextModel } from './utils/model.js';
import {
  compileFieldSelect,
  type PrismaNextQuery,
  type PrismaNextSelectFn,
  type RawSelect,
  scopeOf,
  splitSelect,
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
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref.js';
export { type ModelBrand, PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
export type {
  AnyContract,
  CollectionFor,
  ConnectionCollection,
  CursorSpec,
  IdentityFields,
  InterfaceReturnShape,
  ModelName,
  ModelReturnShape,
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
  ResolverCollection,
  Row,
} from './types.js';

const pluginName = 'prismaNext';

export default pluginName;

const EMPTY: PrismaNextQuery = Object.freeze({});

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
    let model = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    for (const iface of typeConfig.interfaces) {
      const ifaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const ifaceModel = ifaceConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (ifaceModel) {
        if (model && rootModelKey(contract, model) === rootModelKey(contract, ifaceModel)) {
          // A variant keeps its own model when it implements its hierarchy's interface.
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
    const ownSelect = typeConfig.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;
    if (ownSelect) {
      validateStaticSelect(ownSelect, getModel(contract, model), typeConfig.name);
    } else {
      getModel(contract, model);
    }
    return {
      ...typeConfig,
      extensions: { ...typeConfig.extensions, [PRISMA_NEXT_MODEL]: model },
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
    if (extensions[PRISMA_NEXT_FIELD_SELECT] !== undefined) {
      return readingViews(fieldConfig);
    }
    const declaring = this.buildCache.getTypeConfig(declaringType(fieldConfig));
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
    } else if (typeof exposed === 'string' && model.columns && !model.columns.has(exposed)) {
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
      ? readingViews({
          ...fieldConfig,
          extensions: { ...extensions, [PRISMA_NEXT_FIELD_SELECT]: selection },
        })
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

  /**
   * A field resolves with its parent once the columns it reads are there and, for a planned
   * selection, the plan that loaded the parent included it; otherwise the loader reloads the
   * parent with what the field needs. The field's resolver gets its view of the parent: the
   * combine slots its own and its type's selections were planned into, lifted onto the row.
   */
  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const extensions = fieldConfig.extensions ?? {};
    const selection = extensions[PRISMA_NEXT_FIELD_SELECT] as
      | PrismaNextQuery
      | PrismaNextSelectFn
      | undefined;
    const parentConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const modelName = parentConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    if (selection === undefined || modelName === undefined) {
      return resolver;
    }
    const { config } = this;
    const model = getModel(config.contract, modelName);
    const declaring = declaringType(fieldConfig);
    const typeSelects = this.typeSelects(fieldConfig.parentType, modelName).map(
      ({ name, raw }) => ({
        name,
        ...splitSelect(raw, model),
      }),
    );
    // The parent row carries every column and relation its type and interfaces select; one that is
    // missing reloads it.
    const columns = [
      ...new Set([
        ...typeSelects.flatMap((own) => [...own.columns, ...own.relations.map(([name]) => name)]),
        ...(typeof selection === 'function' ? [] : (selection.columns ?? [])),
      ]),
    ];
    // Each type's relation slots, the declaring type's last so its fields read what it selects.
    const typeScopes = typeSelects
      .filter((own) => own.relations.length > 0)
      .map((own) => own.name)
      .sort((a, b) => Number(a === declaring) - Number(b === declaring));
    const planned = typeof selection === 'function' || typeScopes.length > 0;
    const loaded = extensions[PRISMA_NEXT_LOADED] as Loaded | undefined;
    const include = extensions.pothosIndirectInclude as IndirectInclude | undefined;
    // A same-row variant hands the row on unchanged; the variant's fields read their own slots.
    const sameRow = !!include && !include.path?.length && !include.paths?.length;
    const toMany = Object.keys(model.relations).filter((name) => model.relations[name].isToMany);
    // Fields planned on an interface are recorded there but resolve on the concrete type.
    const parentTypes = [
      fieldConfig.parentType,
      ...('interfaces' in parentConfig ? parentConfig.interfaces : [])
        .map((iface) => this.buildCache.getTypeConfig(iface, 'Interface'))
        .filter((iface) => {
          const ifaceModel = iface.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
          return (
            ifaceModel !== undefined &&
            rootModelKey(config.contract, ifaceModel) === rootModelKey(config.contract, modelName)
          );
        })
        .map((iface) => iface.name),
    ];
    const view = (row: object, mapping: Mapping | null | undefined) =>
      sameRow
        ? row
        : (viewOf(row, toMany, [
            ...typeScopes,
            mapping?.position && scopeOf(mapping.position),
          ]) as Record<string, unknown>);
    // The plugins wrapped inside this one (scope-auth's type checks among them) get the row
    // itself; the field's own resolver reads its view.
    const readsView = viewReaders.has(fieldConfig.resolve as never);
    const handOver = (
      row: object,
      own: object,
      args: object,
      context: Types['Context'],
      info: GraphQLResolveInfo,
    ) => {
      if (own === row || !readsView) {
        return resolver(own, args, context, info);
      }
      pendingViews.set(info, { row, view: own });
      return resolver(row, args, context, info);
    };

    let keyless: boolean | undefined;

    return (parent, args, context, info) => {
      if (parent === null || typeof parent !== 'object') {
        return resolver(parent, args, context, info);
      }
      const row = parent as Record<string, unknown>;
      const missing = columns.length
        ? columns.filter((column) => row[column] === undefined)
        : columns;
      let reason: ReloadReason = 'columns';
      if (!missing.length) {
        if (!planned) {
          return resolver(parent, args, context, info);
        }
        assertContextObject(context, info);
        let mapping: Mapping | null = null;
        for (const type of parentTypes) {
          mapping ??= getLoaderMapping(context, info.path, type, parent);
        }
        reason = 'unplanned';
        if (mapping) {
          const own = view(parent, mapping);
          if (!loaded || loaded(own as Record<string, unknown>, args, context, info)) {
            setRowMappings(context, info, mapping.nested);
            return handOver(parent, own, args, context, info);
          }
          reason = 'conflict';
        }
      }
      assertContextObject(context, info);
      keyless ??= !getIdentityFields(config.contract, modelName).length;
      if (keyless) {
        throw keylessReloadError(info, modelName, reason, missing);
      }
      return config
        .loader(context, modelName)
        .loadSelection(info, parent)
        .then((loadedRow) =>
          handOver(loadedRow.row, view(loadedRow.row, loadedRow.mapping), args, context, info),
        );
    };
  }
}

/** Each field's view of its parent, set by `wrapResolve` for the resolver `readingViews` wraps. */
const pendingViews = new WeakMap<GraphQLResolveInfo, { row: object; view: object }>();
const viewReaders = new WeakSet<GraphQLFieldResolver<unknown, unknown>>();

/**
 * A planned field's resolver, reading its view of the parent. `wrapResolve` hands the plugins it
 * wraps the row itself, so per-row work there (scope-auth's cached type checks) sees one object
 * shaped like its type, while the field still reads the slots it was planned into.
 */
function readingViews<Types extends SchemaTypes>(
  fieldConfig: PothosOutputFieldConfig<Types>,
): PothosOutputFieldConfig<Types> {
  const { resolve } = fieldConfig;
  if (!resolve || viewReaders.has(resolve as never)) {
    return fieldConfig;
  }
  const reader: GraphQLFieldResolver<unknown, unknown> = (parent, args, context, info) => {
    const pending = pendingViews.get(info);
    return resolve(
      pending && pending.row === parent ? pending.view : parent,
      args as never,
      context as never,
      info,
    );
  };
  viewReaders.add(reader);
  return { ...fieldConfig, resolve: reader as never };
}

/** What a static `select` names is checked when the schema is built, not on first use. */
function validateStaticSelect(raw: RawSelect, model: PrismaNextModel, owner: string) {
  const { columns, relations } = splitSelect(raw, model);
  for (const column of columns) {
    if (model.columns && !model.columns.has(column)) {
      throw new PothosSchemaError(
        `select on '${owner}': '${column}' is not a column or relation on model ${model.name}.`,
      );
    }
  }
  for (const [name, value] of relations) {
    if (typeof value === 'function' && !model.relations[name]!.isToMany) {
      throw new PothosSchemaError(
        `select on '${owner}': the function form of to-one relation '${name}' requires combine(), which the ORM supports only for to-many relations. Use a relation field with query options or a declarative select instead.`,
      );
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

function declaringType(fieldConfig: { parentType: string }) {
  return (fieldConfig as { declaringType?: string }).declaringType ?? fieldConfig.parentType;
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
