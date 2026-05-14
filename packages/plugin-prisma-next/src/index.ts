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
import { getNullableType, type GraphQLFieldResolver, type GraphQLResolveInfo, isListType } from 'graphql';
import {
  PRISMA_NEXT_COLUMNS,
  PRISMA_NEXT_MODEL,
  PRISMA_NEXT_PREPARED,
  PRISMA_NEXT_RELATIONS,
  PRISMA_NEXT_SELECT,
} from './constants';
import type { PreparedFieldExtension } from './extensions';
import type { AnyContract } from './types';
import { createApply } from './utils/apply';
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
export { PRISMA_NEXT_MODEL, PRISMA_NEXT_PREPARED, PRISMA_NEXT_SELECT } from './constants';
export type { PreparedFieldExtension, RefineCallback } from './extensions';
export { PrismaNextInterfaceRef, prismaInterfaceKey } from './interface-ref';
export { PrismaNextNodeRef, relayIDShapeKey } from './node-ref';
export { PrismaNextObjectRef, prismaModelKey } from './object-ref';
export { PrismaNextObjectFieldBuilder } from './prisma-next-object-field-builder';
export * from './types';
export type { Apply } from './utils/apply';
export { createApply } from './utils/apply';
export {
  applySelectionToCollection,
  type IndirectInclude,
  type MapperCollection,
  type PothosPrismaNextConfig,
} from './utils/apply-selection';
export { rebrandForVariant } from './utils/branding';
export {
  decodeCursor as parsePrismaNextCursor,
  encodeCursor as formatPrismaNextCursor,
} from './utils/cursors';
export { getInterfaceRefFromContractModel, getRefFromContractModel } from './utils/refs';

const pluginName = 'prismaNext';

export default pluginName;

/**
 * Per-relation metadata baked into the type's extension at schema
 * build. The walker consumes this instead of probing the contract per
 * request; M:N detection runs here once, fail-fast.
 */
export interface PrismaNextRelationMeta {
  readonly isToMany: boolean;
  /** Parent-side FK columns; augmented into parent SELECT for depth-2+ stitching. */
  readonly localFields: readonly string[];
  /** Target model name in the contract. */
  readonly targetModel: string;
}

/**
 * Duck-typed Collection detection. The orm-client's `Collection`
 * carries `.select` / `.include` / `.where` / `.all`. We require all
 * four — `.select` + `.all` alone would misdetect a user-defined DTO
 * that coincidentally exposes those method names.
 */
function isOrmCollection(value: unknown): boolean {
  if (value == null || typeof value !== 'object') return false;
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
  let applied = apply(collection) as {
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

function buildRelationMeta(
  modelName: string,
  contract: AnyContract,
  typeName: string,
): Record<string, PrismaNextRelationMeta> | undefined {
  const modelDef = (contract as { models: Record<string, unknown> }).models[modelName] as
    | {
        relations?: Record<
          string,
          {
            cardinality?: string;
            to?: string;
            on?: { localFields?: readonly string[] };
          }
        >;
      }
    | undefined;
  const rels = modelDef?.relations;
  if (!rels) {
    return undefined;
  }
  const out: Record<string, PrismaNextRelationMeta> = {};
  for (const [name, rel] of Object.entries(rels)) {
    // M:N spelling drift: prisma-next's contract emit produces 'N:M'
    // (contract-ts contract-lowering.ts), the orm-client's
    // RelationCardinalityTag uses 'M:N'. Catch both. Either way,
    // the orm-client's include API has no junction-table support
    // (no read path handles `through`), so M:N relations can't be
    // joined through `.include()` even though the DSL accepts
    // `rel.manyToMany`. Reject at schema build with the real reason.
    if (rel.cardinality === 'N:M' || rel.cardinality === 'M:N') {
      throw new PothosSchemaError(
        `Relation '${typeName}.${name}' (model '${modelName}') is many-to-many. ` +
          "prisma-next's orm-client doesn't implement junction-table joins yet, " +
          'so the plugin can\'t auto-include this relation. ' +
          'Workaround: model the junction as its own contract model and chain two ' +
          '`t.relation` calls (User → UserTag → Tag).',
      );
    }
    // Explicit allowlist: anything other than the known cardinalities
    // surfaces as a schema error. Defends against silent mis-routing
    // when the contract grows new cardinality tags.
    const isToMany = rel.cardinality === '1:N';
    if (!isToMany && rel.cardinality !== '1:1' && rel.cardinality !== 'N:1') {
      throw new PothosSchemaError(
        `Relation '${typeName}.${name}' (model '${modelName}') has unknown cardinality ` +
          `'${String(rel.cardinality)}'. Expected '1:1' / 'N:1' / '1:N'.`,
      );
    }
    out[name] = {
      isToMany,
      localFields: rel.on?.localFields ?? [],
      targetModel: rel.to ?? '',
    };
  }
  return out;
}

function buildColumnSet(
  modelName: string,
  contract: AnyContract,
): ReadonlySet<string> | undefined {
  const modelDef = (contract as { models: Record<string, unknown> }).models[modelName] as
    | { fields?: Record<string, unknown> }
    | undefined;
  if (!modelDef?.fields) return undefined;
  return new Set(Object.keys(modelDef.fields));
}

/**
 * Source-row normalize: lift object-level select entries from their
 * per-type namespaced combine slots (`row[rel][':object:<TypeName>:<key>']`)
 * up to top-level properties on each row. Runs at the t.prismaField
 * boundary so plain `t.field` resolvers on the type see the expected
 * flat shape.
 *
 * Per-type prefix means variants that share a row but declare distinct
 * object-level selects route to distinct slots without collision —
 * each variant's normalize uses its own type-name prefix.
 */
function normalizeRowsForType(
  value: unknown,
  typeConfig: PothosTypeConfig | undefined,
  contract: AnyContract | undefined,
): unknown {
  if (!typeConfig || !contract) return value;
  const ext = (typeConfig.extensions ?? {}) as Record<string, unknown>;
  const spec = ext[PRISMA_NEXT_SELECT];
  if (!spec || Array.isArray(spec) || typeof spec !== 'object') return value;
  const modelName = ext[PRISMA_NEXT_MODEL] as string | undefined;
  if (!modelName) return value;
  const modelDef = (contract as { models: Record<string, { relations?: Record<string, unknown> }> })
    .models[modelName];
  if (!modelDef?.relations) return value;
  const relations = modelDef.relations;
  const entries = Object.entries(spec as Record<string, unknown>).filter(
    ([k]) => relations[k] !== undefined,
  );
  if (entries.length === 0) return value;
  // Per-type prefix: e.g. `:object:User:` for the User prismaObject.
  // `:` is GraphQL-forbidden so the prefix never collides with user
  // aliases.
  const prefix = `:object:${typeConfig.name}:`;

  const normalize = (row: unknown): unknown => {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) return row;
    const r = row as Record<string, unknown>;
    for (const [rel] of entries) {
      const slot = r[rel];
      if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
        const slotMap = slot as Record<string, unknown>;
        for (const k of Object.keys(slotMap)) {
          if (k.startsWith(prefix)) {
            r[k.slice(prefix.length)] = slotMap[k];
          }
        }
      }
    }
    return r;
  };

  if (value && typeof value === 'object' && 'then' in value && typeof (value as { then?: unknown }).then === 'function') {
    return (value as Promise<unknown>).then((v) => normalizeRowsForType(v, typeConfig, contract));
  }
  if (Array.isArray(value)) {
    return value.map(normalize);
  }
  return normalize(value);
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
    // request. M:N + unknown-cardinality rejection also fires here
    // (fail-fast), not on first request.
    const opts = readPluginOptions<AnyContract>(this.builder);
    const relations: Record<string, PrismaNextRelationMeta> | undefined = opts?.contract
      ? buildRelationMeta(model, opts.contract, typeConfig.name)
      : undefined;
    const columns: ReadonlySet<string> | undefined = opts?.contract
      ? buildColumnSet(model, opts.contract)
      : undefined;
    return {
      ...typeConfig,
      extensions: {
        ...typeConfig.extensions,
        [PRISMA_NEXT_MODEL]: model,
        ...(relations !== undefined ? { [PRISMA_NEXT_RELATIONS]: relations } : {}),
        ...(columns !== undefined ? { [PRISMA_NEXT_COLUMNS]: columns } : {}),
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
      // Resolve the return type's config once so the per-resolve
      // normalize step has a stable handle to the object-level select
      // manifest. `getTypeConfig` walks buildCache — cheap on first
      // call, hashed on subsequent.
      let returnTypeConfig: PothosTypeConfig | undefined;
      try {
        returnTypeConfig = this.buildCache.getTypeConfig(typeName);
      } catch {
        // typeName might be an interface or union — normalize is
        // skipped in that case (object-level select isn't defined on
        // those abstract types).
        returnTypeConfig = undefined;
      }
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
        // Anything else (null, array, raw row) passes through to the
        // row normalizer.
        const materialized =
          result != null && !Array.isArray(result) && isOrmCollection(result)
            ? await materializeCollection(
                result,
                info,
                contract,
                context,
                mapperOpts,
              )
            : result;

        return normalizeRowsForType(materialized, returnTypeConfig, contract);
      };
    }

    // Object-form `select` on a `t.field` (or `t.relation` and friends
    // after their refactor): install an overlay wrap that lifts
    // namespaced combine slots onto top-level properties on a
    // per-resolve cloned parent.
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
    if (!isObjectOrCallableSelect) {
      return resolver;
    }
    const baseResolver = resolver;
    // Resolve the field's return type config once at schema-build so
    // the per-resolve normalize step can apply object-level select
    // entries from the returned type. Per-boundary local rewrap: each
    // field returning rows normalizes them before downstream resolvers
    // run.
    const builderForCapture = this.builder;
    const buildCacheForCapture = this.buildCache;
    let returnTypeConfig: PothosTypeConfig | undefined;
    try {
      const fieldType = (fieldConfig as unknown as { type: { kind?: string; type?: { ref?: string; name?: string }; ref?: string; name?: string } }).type;
      const inner = fieldType?.type ?? fieldType;
      const refName = (inner as { ref?: string; name?: string })?.name ?? (inner as { ref?: string })?.ref;
      if (typeof refName === 'string') {
        returnTypeConfig = buildCacheForCapture.getTypeConfig(refName);
      }
    } catch {
      returnTypeConfig = undefined;
    }
    const contractForCapture = readPluginOptions<AnyContract>(builderForCapture)?.contract;

    return (parent, args, context, info) => {
      if (parent == null || typeof parent !== 'object') {
        return baseResolver(parent, args, context, info);
      }
      const alias = info.fieldNodes[0]?.alias?.value ?? info.fieldName;
      // `:` is GraphQL-forbidden, so the prefix can't collide with any
      // user-defined GraphQL alias or relation name.
      const prefix = `${alias}:`;
      const p = parent as Record<string, unknown>;
      // Object.create(parent) preserves the prototype chain so variant
      // re-brands (which use Object.create to attach a type brand)
      // still surface their inherited row props via overlay. Adding a
      // top-level property on the overlay shadows that level only.
      const overlay = Object.create(p) as Record<string, unknown>;
      // `for...in` over `p` walks the prototype chain so we still find
      // combine slots when `parent` is a variant wrapper from
      // `rebrandForVariant` (which puts the row on the prototype). A
      // visited set guards against re-processing the same key visible
      // at multiple levels.
      const seen = new Set<string>();
      for (const key in p) {
        if (seen.has(key)) continue;
        seen.add(key);
        const slot = p[key];
        if (slot && typeof slot === 'object' && !Array.isArray(slot)) {
          for (const k of Object.keys(slot)) {
            if (k.startsWith(prefix)) {
              const innerKey = k.slice(prefix.length);
              overlay[innerKey] = (slot as Record<string, unknown>)[k];
            }
          }
        }
      }
      const result = baseResolver(overlay, args, context, info);
      return normalizeRowsForType(result, returnTypeConfig, contractForCapture);
    };
  }
}

SchemaBuilder.registerPlugin(pluginName, PothosPrismaNextPlugin);
