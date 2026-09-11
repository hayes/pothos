import './global-types.js';
import './prisma-next-connection.js';
import './prisma-next-field-builder.js';
import './schema-builder.js';
import SchemaBuilder, {
  BasePlugin,
  isThenable,
  type PothosOutputFieldConfig,
  PothosSchemaError,
  type PothosTypeConfig,
  type SchemaTypes,
} from '@pothos/core';
import {
  type GraphQLFieldResolver,
  type GraphQLResolveInfo,
  getNamedType,
  getNullableType,
  isListType,
} from 'graphql';
import {
  PRISMA_NEXT_FIELD_SELECT,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_PREPARED,
  PRISMA_NEXT_RELATIONS,
  PRISMA_NEXT_SELECT,
} from './constants.js';
import type { AnyContract } from './types.js';
import { fieldAliasPrefix, objectLevelFieldAlias } from './utils/adapter.js';
import { createApply } from './utils/apply.js';
import { resolveContractModel } from './utils/contract.js';
import { buildRelationMeta, type PrismaNextRelationMeta } from './utils/model.js';
import { mapperOptionsFromPluginOpts, readPluginOptions } from './utils/options.js';

export type {
  AggregateBuilder,
  AggregateResult,
  AggregateSpec,
  Collection,
  CreateInput,
  GroupedCollection,
  ModelAccessor,
  RelationFilterAccessor,
  RelationPredicate,
  ShorthandWhereFilter,
  UniqueConstraintCriterion,
} from '@prisma-next/sql-orm-client';
// `IncludeRefinementCollection` and `IsToManyRelation` are re-exported via
// `export * from './types'` below — orm-client made them internal in 0.14.0,
// so the plugin owns reconstructed copies. `IncludeRefinementResult` was
// dropped (see the note in ./types).
export { all, and, not, or } from '@prisma-next/sql-orm-client';
export type { PrismaConnectionHelpers } from './connection-helpers.js';
export { prismaConnectionHelpers } from './connection-helpers.js';
export { PRISMA_NEXT_MODEL, PRISMA_NEXT_PREPARED, PRISMA_NEXT_SELECT } from './constants.js';
export type { PreparedFieldExtension, RefineCallback } from './extensions.js';
export { PrismaNextInterfaceRef, prismaInterfaceKey } from './interface-ref.js';
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref.js';
export { PrismaNextObjectRef, prismaModelKey } from './object-ref.js';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder.js';
export * from './types.js';
export {
  type MapperCollection,
  type PrismaNextSpec,
  prismaNextAdapter,
} from './utils/adapter.js';
export type { Apply } from './utils/apply.js';
export { createApply } from './utils/apply.js';
export { rebrandForVariant } from './utils/branding.js';
export {
  decodeCursor as parsePrismaNextCursor,
  encodeCursor as formatPrismaNextCursor,
} from './utils/cursors.js';
export {
  type ApplySelectionOptions,
  applySelectionToCollection,
  type IndirectInclude,
} from './utils/map-query.js';
export type {
  PrismaNextModel,
  PrismaNextRelation,
  PrismaNextRelationMeta,
  PrismaNextRelationThrough,
} from './utils/model.js';
export { getInterfaceRefFromContractModel, getRefFromContractModel } from './utils/refs.js';

const pluginName = 'prismaNext';

export default pluginName;

/**
 * Duck-typed Collection detection. The orm-client's `Collection`
 * carries `.select` / `.include` / `.where` / `.all`. We require all
 * four — `.select` + `.all` alone would misdetect a user-defined DTO
 * that coincidentally exposes those method names.
 */
function isOrmCollection(value: unknown): boolean {
  if (value == null || typeof value !== 'object') {
    return false;
  }
  const v = value as { select?: unknown; include?: unknown; where?: unknown; all?: unknown };
  return (
    typeof v.select === 'function' &&
    typeof v.include === 'function' &&
    typeof v.where === 'function' &&
    typeof v.all === 'function'
  );
}

async function materializeCollection(
  collection: unknown,
  info: GraphQLResolveInfo,
  contract: AnyContract,
  context: unknown,
  mapperOpts: ReturnType<typeof mapperOptionsFromPluginOpts>,
): Promise<unknown> {
  const apply = createApply({ info, contract, context, mapperOpts });
  // A promise only when a select callback beneath the field was async.
  let applied = (await apply(collection)) as {
    all: () => Promise<readonly unknown[]>;
    take?: (n: number) => unknown;
  };
  // Single-row fields: inject `.take(1)` so we don't pull the whole
  // collection just to read row 0. List fields take whatever the user
  // returned.
  const inner = getNullableType(info.returnType);
  const wantsList = isListType(inner);
  if (!wantsList && typeof applied.take === 'function') {
    applied = applied.take(1) as typeof applied;
  }
  // `.all()` resolves to a real array on every orm-client adapter
  // we target — no async-iterable fallback path.
  const rows = (await applied.all()) as readonly unknown[];
  return wantsList ? rows : (rows[0] ?? null);
}

// Inherited by variant wrappers so later resolvers can still read the original combine maps.
const sourceRow = Symbol('prismaNextSourceRow');

// A shared to-one include scopes child consumers, while the single-include fast
// path keeps them local. Candidates record those explicit planner alternatives;
// they are carried with the row, never reconstructed from a GraphQL response path.
const rowScopes = Symbol('prismaNextRowScopes');
type ScopedRow = { [sourceRow]?: object; [rowScopes]?: readonly string[] };

function childScopes(parent: object, alias: string): string[] {
  return [...((parent as ScopedRow)[rowScopes] ?? []).map((scope) => `${scope}:${alias}`), alias];
}

function scopedRow(row: object, scopes: readonly string[]): object {
  const wrapper = Object.create(row) as object;
  Object.defineProperties(wrapper, {
    [sourceRow]: { value: (row as ScopedRow)[sourceRow] ?? row },
    [rowScopes]: { value: scopes },
  });
  return wrapper;
}

function selectedPrefix(slot: object, scopes: readonly string[]): string | undefined {
  const keys = Object.keys(slot);
  return scopes.map(fieldAliasPrefix).find((prefix) => keys.some((key) => key.startsWith(prefix)));
}

function liftSlots(overlay: object, slot: object, scopes: readonly string[]) {
  const prefix = selectedPrefix(slot, scopes);
  if (!prefix) {
    return;
  }
  for (const key of Object.keys(slot)) {
    if (key.startsWith(prefix)) {
      Object.defineProperty(overlay, key.slice(prefix.length), {
        value: (slot as Record<string, unknown>)[key],
        enumerable: true,
        configurable: true,
        writable: true,
      });
    }
  }
}

/** Present type-level selections without modifying the shared ORM row or its combine maps. */
function normalizeParentForType(
  parent: object,
  relations: readonly string[],
  alias: string,
): Record<string, unknown> {
  const overlay = Object.create(parent) as Record<string, unknown>;
  const source = (parent as ScopedRow)[sourceRow] ?? parent;
  Object.defineProperty(overlay, sourceRow, { value: source });
  const scopes = childScopes(parent, alias);
  for (const relation of relations) {
    const slot = (source as Record<string, unknown>)[relation];
    if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
      liftSlots(overlay, slot, scopes);
    }
  }
  return overlay;
}

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
    // Precompute per-relation metadata + the model's column set at
    // schema-build time so the walker doesn't probe the contract per
    // request. Unknown-cardinality rejection also fires here (fail-fast),
    // not on first request.
    const opts = readPluginOptions<AnyContract>(this.builder);
    const relations: Record<string, PrismaNextRelationMeta> | undefined = opts?.contract
      ? buildRelationMeta(model, opts.contract, typeConfig.name)
      : undefined;
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
        ...(relations !== undefined ? { [PRISMA_NEXT_RELATIONS]: relations } : {}),
      },
    };
  }

  override wrapResolve(
    resolver: GraphQLFieldResolver<unknown, Types['Context'], object, unknown>,
    fieldConfig: PothosOutputFieldConfig<Types>,
  ): GraphQLFieldResolver<unknown, Types['Context'], object> {
    const ext = (fieldConfig.extensions ?? {}) as Record<string | symbol, unknown>;

    if (ext[PRISMA_NEXT_PREPARED]) {
      // Resolve plugin options once at schema-build time — `wrapResolve`
      // runs per field; the returned closure runs per request.
      const opts = readPluginOptions<AnyContract>(this.builder);
      if (!opts) {
        throw new PothosSchemaError('t.prismaField requires builder.options.prismaNext to be set.');
      }
      const mapperOpts = mapperOptionsFromPluginOpts(opts);
      const contract = opts.contract;
      return async (parent, args, context, info) => {
        const raw = (
          resolver as unknown as (
            parent: unknown,
            args: unknown,
            context: unknown,
            info: GraphQLResolveInfo,
          ) => unknown
        )(parent, args, context, info);
        const result =
          raw && typeof (raw as { then?: unknown }).then === 'function'
            ? await (raw as Promise<unknown>)
            : raw;

        // Auto-wrap: if the resolver returned a Collection (duck-typed
        // via `.select` + `.all`), apply selection and materialize.
        // Anything else (null, array, raw row) passes through unchanged.
        const materialized =
          result != null && !Array.isArray(result) && isOrmCollection(result)
            ? await materializeCollection(result, info, contract, context, mapperOpts)
            : result;

        return materialized;
      };
    }

    // Object-form `select` on a `t.field` (or `t.relation` and friends),
    // or a selection the plugin's sugar precompiled (`t.relatedConnection`):
    // install an overlay wrap that lifts namespaced combine slots onto
    // top-level properties on a per-resolve cloned parent.
    //
    // Fully dynamic — works for any spec shape (true / declarative /
    // function-form / outer callback). The scan finds combine maps on
    // parent and lifts keys with prefix `<alias>:`. Single-include
    // (no combine) values pass through untouched.
    const pothosOpts = (fieldConfig as unknown as { pothosOptions?: { select?: unknown } })
      .pothosOptions;
    const selectOpt = pothosOpts?.select;
    const isObjectOrCallableSelect =
      selectOpt !== undefined &&
      ((typeof selectOpt === 'object' && selectOpt !== null && !Array.isArray(selectOpt)) ||
        typeof selectOpt === 'function');
    const parentTypeConfig = this.buildCache.getTypeConfig(fieldConfig.parentType);
    const typeSelect = parentTypeConfig.extensions?.[PRISMA_NEXT_SELECT];
    const modelName = parentTypeConfig.extensions?.[PRISMA_NEXT_MODEL] as string | undefined;
    const contract = readPluginOptions<AnyContract>(this.builder)?.contract;
    const modelRelations =
      contract && modelName ? resolveContractModel(contract, modelName)?.relations : undefined;
    const toOneRelations = Object.entries(modelRelations ?? {})
      .filter(([, relation]) => relation.cardinality !== '1:N' && relation.cardinality !== 'N:M')
      .map(([name]) => name);
    const typeRelations =
      typeSelect && !Array.isArray(typeSelect) && typeof typeSelect === 'object'
        ? Object.keys(typeSelect).filter((key) => modelRelations?.[key] !== undefined)
        : [];
    const typeAlias = objectLevelFieldAlias(parentTypeConfig.name);
    const hasTypeSelect = typeRelations.length > 0;
    const hasFieldSelect = isObjectOrCallableSelect || !!ext[PRISMA_NEXT_FIELD_SELECT];
    const indirect = ext.pothosIndirectInclude as
      | { path?: unknown[]; paths?: unknown[] }
      | undefined;
    const isSameRow = !!indirect && !indirect.path?.length && !indirect.paths?.length;
    if (!hasTypeSelect && !hasFieldSelect && !isSameRow) {
      return resolver;
    }
    const baseResolver = resolver;

    return (parent, args, context, info) => {
      if (parent == null || typeof parent !== 'object') {
        return baseResolver(parent, args, context, info);
      }
      // The prefix the adapter wrote the combine slot under. `:` is GraphQL-forbidden, so it
      // cannot collide with a user-defined alias or relation name.
      const alias = info.fieldNodes[0]?.alias?.value ?? info.fieldName;
      const scopes = childScopes(parent, alias);
      const p = ((parent as { [sourceRow]?: object })[sourceRow] ?? parent) as Record<
        string,
        unknown
      >;
      // Object.create(parent) preserves the prototype chain so variant
      // re-brands (which use Object.create to attach a type brand)
      // still surface their inherited row props via overlay. Adding a
      // top-level property on the overlay shadows that level only.
      const overlay = normalizeParentForType(parent, typeRelations, typeAlias);
      // `for...in` over `p` walks the prototype chain so we still find combine slots when
      // `parent` is a variant wrapper from `rebrandForVariant` (which puts the row on the
      // prototype). It never yields a shadowed name twice, so no visited set is needed.
      for (const key in hasFieldSelect ? p : {}) {
        const slot = p[key];
        if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
          liftSlots(overlay, slot, scopes);
        }
      }
      // Scope model rows before other plugins transform the field's return shape.
      // Errors success wrappers, for example, expose this same row via a data
      // field even though their declared GraphQL return type is a union.
      if (hasFieldSelect) {
        for (const name of toOneRelations) {
          const value = overlay[name];
          if (value && typeof value === 'object' && !Array.isArray(value)) {
            Object.defineProperty(overlay, name, {
              value: scopedRow(value, scopes),
              enumerable: true,
              configurable: true,
              writable: true,
            });
          }
        }
      }
      const result = baseResolver(overlay, args, context, info);
      const finish = (value: unknown) => {
        if (!value || typeof value !== 'object' || value instanceof Error) {
          return value;
        }
        if (Array.isArray(value)) {
          // To-many branches own their rows; descendants use local namespaces.
          return value.some(
            (row) => row && typeof row === 'object' && (row as ScopedRow)[rowScopes],
          )
            ? value.map((row) => (row && typeof row === 'object' ? scopedRow(row, []) : row))
            : value;
        }
        if (isSameRow) {
          return scopedRow(value, scopes);
        }
        if (getNamedType(info.returnType).extensions?.[PRISMA_NEXT_MODEL]) {
          return (value as ScopedRow)[rowScopes] === scopes ? value : scopedRow(value, scopes);
        }
        return value;
      };
      return isThenable(result) ? Promise.resolve(result).then(finish) : finish(result);
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
