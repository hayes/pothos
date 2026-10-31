import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
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
import { getPluginConfig } from './utils/config.js';
import { rootModelKey } from './utils/contract.js';
import { getModel } from './utils/model.js';
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
export { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
export type {
  AnyContract,
  CollectionFor,
  ConnectionCollection,
  CursorSpec,
  ModelName,
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
    // Fails the schema build for a contract the planner can't represent.
    getModel(contract, model);
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
      return fieldConfig;
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
    const selection =
      select !== undefined
        ? compileFieldSelect(
            this.config.contract,
            select,
            getModel(this.config.contract, modelName),
            declaring.name,
          )
        : typeof exposed === 'string'
          ? { columns: [exposed] }
          : declaring.extensions?.[PRISMA_NEXT_SELECT]
            ? EMPTY
            : undefined;
    return selection
      ? { ...fieldConfig, extensions: { ...extensions, [PRISMA_NEXT_FIELD_SELECT]: selection } }
      : fieldConfig;
  }

  override afterBuild(schema: GraphQLSchema): GraphQLSchema {
    const { contract } = this.config;
    for (const type of Object.values(schema.getTypeMap())) {
      if (isInterfaceType(type) && type.extensions?.[PRISMA_NEXT_DISCRIMINATED]) {
        variantTypeNames(contract, schema, type);
      }
    }
    return schema;
  }

  /**
   * A field resolves with its parent once the columns it reads are there and, for a planned
   * selection, the plan that loaded the parent included it; otherwise the loader reloads the
   * parent with what the field needs. The parent is handed over as the field's view of it: the
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
    const declaring = this.buildCache.getTypeConfig(declaringType(fieldConfig));
    const typeSelect = declaring.extensions?.[PRISMA_NEXT_SELECT] as RawSelect | undefined;
    const typeParts = typeSelect ? splitSelect(typeSelect, model) : undefined;
    const columns = [
      ...(typeParts?.columns ?? []),
      ...(typeof selection === 'function' ? [] : (selection.columns ?? [])),
    ];
    const typeScope = typeParts?.relations.length ? declaring.name : undefined;
    const planned = typeof selection === 'function' || typeScope !== undefined;
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
            typeScope,
            mapping?.position && scopeOf(mapping.position),
          ]) as Record<string, unknown>);

    return (parent, args, context, info) => {
      if (parent === null || typeof parent !== 'object') {
        return resolver(parent, args, context, info);
      }
      const row = parent as Record<string, unknown>;
      if (columns.every((column) => row[column] !== undefined)) {
        if (!planned) {
          return resolver(parent, args, context, info);
        }
        let mapping: Mapping | null = null;
        for (const type of parentTypes) {
          mapping ??= getLoaderMapping(context, info.path, type, parent);
        }
        if (mapping) {
          const own = view(parent, mapping);
          if (!loaded || loaded(own as Record<string, unknown>, args, context, info)) {
            setRowMappings(context, info, mapping.nested);
            return resolver(own, args, context, info);
          }
        }
      }
      return config
        .loader(context, modelName)
        .loadSelection(info, parent)
        .then((loadedRow) => resolver(view(loadedRow.row, loadedRow.mapping), args, context, info));
    };
  }
}

function declaringType(fieldConfig: { parentType: string }) {
  return (fieldConfig as { declaringType?: string }).declaringType ?? fieldConfig.parentType;
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
