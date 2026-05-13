import './global-types';
import './prisma-next-connection';
import './prisma-next-field-builder';
import './schema-builder';
import SchemaBuilder, {
  BasePlugin,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import type { GraphQLFieldResolver, GraphQLResolveInfo } from 'graphql';
import { PRISMA_NEXT_MODEL, PRISMA_NEXT_PREPARED } from './constants';
import type { PreparedFieldExtension } from './extensions';
import type { AnyContract } from './types';
import { createApply } from './utils/apply';
import { brandResult } from './utils/branding';
import { mapperOptionsFromPluginOpts, readPluginOptions } from './utils/options';

export type {
  AggregateBuilder,
  AggregateResult,
  AggregateSpec,
  Collection,
  CreateInput,
  GroupedCollection,
  IncludeRefinementCollection,
  IncludeRefinementResult,
  IsToManyRelation,
  ModelAccessor,
  RelationFilterAccessor,
  RelationPredicate,
  ShorthandWhereFilter,
  UniqueConstraintCriterion,
} from '@prisma-next/sql-orm-client';
export { all, and, not, or } from '@prisma-next/sql-orm-client';
export type { PrismaConnectionHelpers } from './connection-helpers';
export { prismaConnectionHelpers } from './connection-helpers';
export {
  PRISMA_NEXT_FIELD_OP,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_PREPARED,
  PRISMA_NEXT_SELECT,
} from './constants';
export type {
  AggregateFieldOp,
  CountFieldOp,
  IncludeFieldOp,
  PaginatedIncludeFieldOp,
  PreparedFieldExtension,
  PrismaNextFieldOp,
  RefineCallback,
  SameRowFieldOp,
} from './extensions';
export { PrismaNextInterfaceRef, prismaInterfaceKey } from './interface-ref';
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref';
export { PrismaNextObjectRef, prismaModelKey } from './object-ref';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder';
export * from './types';
export type { Apply } from './utils/apply';
export { createApply } from './utils/apply';
export {
  applySelectionToCollection,
  type BranchSelection,
  type CountSelection,
  type IndirectInclude,
  type MapFromInfoOptions,
  type MapperCollection,
  mapSelectionFromInfo,
  type PaginationSpec,
  type PothosPrismaNextConfig,
  type PreparedQuery,
  type PrismaNextSelection,
  type RelationSelection,
  renderSelection,
} from './utils/apply-selection';
export { brandResult, rebrandForVariant } from './utils/branding';
export {
  decodeCursor as parsePrismaNextCursor,
  encodeCursor as formatPrismaNextCursor,
} from './utils/cursors';
export { getInterfaceRefFromContractModel, getRefFromContractModel } from './utils/refs';

const pluginName = 'prismaNext';

export default pluginName;

export class PothosPrismaNextPlugin<Types extends SchemaTypes> extends BasePlugin<Types> {
  override onTypeConfig(typeConfig: PothosTypeConfig): PothosTypeConfig {
    if (typeConfig.kind !== 'Object' && typeConfig.kind !== 'Interface') {
      return typeConfig;
    }
    let model = typeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    for (const iface of typeConfig.interfaces) {
      const ifaceConfig = this.buildCache.getTypeConfig(iface, 'Interface');
      const ifaceModel = ifaceConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
      if (ifaceModel) {
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
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
      },
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const ext = (fieldConfig.extensions ?? {}) as Record<string | symbol, unknown>;

    if (ext[PRISMA_NEXT_PREPARED]) {
      const prepared = ext[PRISMA_NEXT_PREPARED] as PreparedFieldExtension;
      const { typeName } = prepared;
      // Resolve plugin options once at schema-build time — `wrapResolve`
      // runs per field; the returned closure runs per request.
      const opts = readPluginOptions<AnyContract>(this.builder);
      if (!opts) {
        throw new PothosSchemaError('t.prismaField requires builder.options.prismaNext to be set.');
      }
      const mapperOpts = mapperOptionsFromPluginOpts(opts);
      const contract = opts.contract;
      return (parent, args, context, info) => {
        const apply = createApply({
          info,
          contract,
          context,
          mapperOpts,
        });
        const result = (
          resolver as unknown as (
            apply: unknown,
            parent: unknown,
            args: unknown,
            context: unknown,
            info: GraphQLResolveInfo,
          ) => unknown
        )(apply, parent, args, context, info);
        return brandResult(result, typeName);
      };
    }

    return resolver;
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
