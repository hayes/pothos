/**
 * GraphQL info → `PrismaNextSelection` mapper.
 *
 * Each field with prisma-next-relevant behavior carries a single
 * `PRISMA_NEXT_FIELD_OP` extension; this walks the info, reads those
 * extensions, and emits a data-shaped tree (see `selection.ts`). The
 * companion renderer (`render-selection.ts`) turns the tree into a
 * prisma-next Collection chain.
 *
 * Splitting mapper from renderer keeps the tree snapshot-testable and
 * lets third-party plugins inspect or contribute before render.
 *
 * The mapper honors `pothosIndirectInclude` on a type (set by e.g.
 * plugin-errors on result-union types) and the field-level `paths` on
 * `paginatedInclude` ops. Both descend through the same machinery so
 * a result-union *of* a connection works without special-casing.
 */
import { getMappedArgumentValues, PothosValidationError } from '@pothos/core';
import {
  type FieldNode,
  type FragmentDefinitionNode,
  type FragmentSpreadNode,
  type GraphQLField,
  GraphQLIncludeDirective,
  type GraphQLInterfaceType,
  type GraphQLNamedType,
  type GraphQLObjectType,
  type GraphQLResolveInfo,
  GraphQLSkipDirective,
  getDirectiveValues,
  getNamedType,
  type InlineFragmentNode,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionSetNode,
} from 'graphql';
import { PRISMA_NEXT_FIELD_OP, PRISMA_NEXT_MODEL, PRISMA_NEXT_SELECT } from '../constants';
import type { IncludeFieldOp, PaginatedIncludeFieldOp, PrismaNextFieldOp } from '../extensions';
import type { AnyContract } from '../types';
import { emptySelection, getOrCreateRelation, type PrismaNextSelection } from './selection';
import { selectionSetIncludesField } from './selection-walk';

export interface PothosPrismaNextConfig {
  contract: AnyContract;
  skipDeferredFragments: boolean;
  defaultConnectionSize?: number;
  maxConnectionSize?: number;
}

export interface IndirectInclude {
  getType: () => string;
  path?: { type?: string; name: string }[];
  paths?: { type?: string; name: string }[][];
}

export interface MapFromInfoOptions {
  config: PothosPrismaNextConfig;
  context: object;
  info: GraphQLResolveInfo;
  typeName?: string;
  path?: string[];
  paths?: string[][];
  extraColumns?: readonly string[];
}

export function mapSelectionFromInfo(options: MapFromInfoOptions): PrismaNextSelection {
  const { config, context, info, typeName, path, paths, extraColumns = [] } = options;
  const returnType = getNamedType(info.returnType);
  const rootType = typeName ? info.schema.getTypeMap()[typeName]! : returnType;

  let mapped: PrismaNextSelection = emptySelection();
  for (const col of extraColumns) {
    mapped.columns.add(col);
  }

  if (path?.length || paths?.length) {
    const { pothosIndirectInclude } = (returnType.extensions ?? {}) as {
      pothosIndirectInclude?: IndirectInclude;
    };
    resolveIndirectInclude(
      returnType,
      info,
      info.fieldNodes[0]!,
      pothosIndirectInclude?.path ?? [],
      [],
      (indirectType, indirectField, _subPath, deferred) => {
        resolveIndirectIncludePaths(
          indirectType,
          info,
          indirectField,
          [],
          paths?.length
            ? paths.map((p) => p.map((n) => (typeof n === 'string' ? { name: n } : n)))
            : [path!.map((n) => (typeof n === 'string' ? { name: n } : n))],
          [],
          (resolvedType, resolvedField, _path, resolvedDeferred) => {
            const sub = mapField(
              typeName ? rootType : resolvedType,
              resolvedField,
              info,
              config,
              context,
              resolvedDeferred,
            );
            mapped = mergeSelection(mapped, sub);
          },
          deferred,
        );
      },
    );
    return mapped;
  }

  const sub = mapField(rootType, info.fieldNodes[0]!, info, config, context, false);
  return mergeSelection(mapped, sub);
}

/**
 * Merge semantics: columns union; same-relation aliases must not
 * collide (duplicates are caught earlier as validation errors). Used
 * by indirect-include resolution and `sameRow` descent.
 */
function mergeSelection(
  target: PrismaNextSelection,
  incoming: PrismaNextSelection,
): PrismaNextSelection {
  for (const col of incoming.columns) {
    target.columns.add(col);
  }
  for (const [relationName, rel] of incoming.relations) {
    const existing = target.relations.get(relationName);
    if (!existing) {
      target.relations.set(relationName, rel);
      continue;
    }
    for (const [alias, branch] of rel.branches) {
      if (existing.branches.has(alias)) {
        throw new PothosValidationError(
          `Duplicate alias "${alias}" for relation "${relationName}"`,
        );
      }
      existing.branches.set(alias, branch);
    }
    for (const [alias, count] of rel.counts) {
      if (existing.counts.has(alias)) {
        throw new PothosValidationError(
          `Duplicate alias "${alias}" for relationCount "${relationName}"`,
        );
      }
      existing.counts.set(alias, count);
    }
    for (const [alias, agg] of rel.aggregates) {
      if (existing.aggregates.has(alias)) {
        throw new PothosValidationError(
          `Duplicate alias "${alias}" for relationAggregate "${relationName}"`,
        );
      }
      existing.aggregates.set(alias, agg);
    }
  }
  return target;
}

function mapField(
  type: GraphQLNamedType,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  deferred: boolean,
): PrismaNextSelection {
  if (selection.name.value.startsWith('__')) {
    return emptySelection();
  }

  const { pothosIndirectInclude } = (type.extensions ?? {}) as {
    pothosIndirectInclude?: IndirectInclude;
  };

  if (
    (!!pothosIndirectInclude?.path && pothosIndirectInclude.path.length > 0) ||
    (!!pothosIndirectInclude?.paths && pothosIndirectInclude.paths.length > 0)
  ) {
    let result: PrismaNextSelection = emptySelection();
    resolveIndirectIncludePaths(
      type,
      info,
      selection,
      [],
      pothosIndirectInclude.paths ?? [pothosIndirectInclude.path!],
      [],
      (resolvedType, resolvedField, _path, resolvedDeferred) => {
        const sub = mapField(resolvedType, resolvedField, info, config, context, resolvedDeferred);
        result = mergeSelection(result, sub);
      },
      deferred,
    );
    return result;
  }
  if (pothosIndirectInclude) {
    return mapField(
      info.schema.getType(pothosIndirectInclude.getType())!,
      selection,
      info,
      config,
      context,
      deferred,
    );
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return emptySelection();
  }
  if (!selection.selectionSet || (deferred && config.skipDeferredFragments)) {
    return emptySelection();
  }

  return mapSelectionSet(type, selection.selectionSet, info, config, context);
}

function mapSelectionSet(
  type: GraphQLObjectType | GraphQLInterfaceType,
  selectionSet: SelectionSetNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
): PrismaNextSelection {
  const selection = emptySelection();

  // Type-level always-load (`prismaObject({ select })`). Honored on
  // every descent so nested-type declarations also force into the
  // include's SELECT.
  const typeSelect = (type.extensions ?? ({} as Record<string, unknown>))[PRISMA_NEXT_SELECT] as
    | readonly string[]
    | undefined;
  if (typeSelect) {
    for (const col of typeSelect) {
      selection.columns.add(col);
    }
  }

  collectSelections(type, selectionSet, info, config, context, selection, new Set());

  // FK augmentation: pull each included relation's localFields into
  // the parent SELECT so prisma-next's nested-stitch works at depth 2+
  // even when the GraphQL query didn't ask for the FK.
  for (const rel of selection.relations.values()) {
    for (const branch of rel.branches.values()) {
      for (const fk of branch.parentFkColumns) {
        selection.columns.add(fk);
      }
    }
  }

  return selection;
}

// `visited` guards against fragment cycles for callers that bypass
// GraphQL.js's NoFragmentCyclesRule (persisted queries / custom
// executors).
function collectSelections(
  type: GraphQLObjectType | GraphQLInterfaceType,
  selectionSet: SelectionSetNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  out: PrismaNextSelection,
  visited: Set<string>,
) {
  for (const sel of selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        collectField(type, sel, info, config, context, out);
        continue;
      case Kind.FRAGMENT_SPREAD: {
        if (config.skipDeferredFragments && isDeferredFragment(sel, info)) {
          continue;
        }
        const name = sel.name.value;
        if (visited.has(name)) {
          continue;
        }
        const fragment = info.fragments[name];
        if (!fragment) {
          continue;
        }
        const fragType = info.schema.getType(fragment.typeCondition.name.value);
        if (!fragType) {
          continue;
        }
        if (!fragmentApplies(type, fragType)) {
          continue;
        }
        visited.add(name);
        collectSelections(
          fragType as GraphQLObjectType,
          fragment.selectionSet,
          info,
          config,
          context,
          out,
          visited,
        );
        visited.delete(name);
        continue;
      }
      case Kind.INLINE_FRAGMENT: {
        if (config.skipDeferredFragments && isDeferredFragment(sel, info)) {
          continue;
        }
        const fragType = sel.typeCondition
          ? info.schema.getType(sel.typeCondition.name.value)
          : type;
        if (!fragType) {
          continue;
        }
        if (!fragmentApplies(type, fragType)) {
          continue;
        }
        collectSelections(
          fragType as GraphQLObjectType,
          sel.selectionSet,
          info,
          config,
          context,
          out,
          visited,
        );
        continue;
      }
      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(sel as { kind: string }).kind}`,
        );
    }
  }
}

// Cross-type fragments are skipped; for interface parents, any
// same-model concrete implementation applies (same row).
function fragmentApplies(parent: GraphQLNamedType, fragType: GraphQLNamedType): boolean {
  return isObjectType(parent) ? fragType.name === parent.name : sameModel(parent, fragType);
}

function sameModel(a: GraphQLNamedType, b: GraphQLNamedType): boolean {
  const aModel = getModelNameForType(a);
  const bModel = getModelNameForType(b);
  return aModel !== undefined && aModel === bModel;
}

const POTHOS_EXPOSED_FIELD = 'pothosExposedField';
const POTHOS_FIELD_OPTIONS = 'pothosOptions';

function collectField(
  type: GraphQLObjectType | GraphQLInterfaceType,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  out: PrismaNextSelection,
) {
  if (selection.name.value.startsWith('__') || fieldSkipped(info, selection)) {
    return;
  }
  const field = type.getFields()[selection.name.value];
  if (!field) {
    throw new PothosValidationError(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  const ext = (field.extensions ?? {}) as Record<string | symbol, unknown>;
  const alias = selection.alias?.value ?? selection.name.value;

  // Reject reserved aliases: the renderer assigns `spec[alias]` on a
  // combine spec, so `__proto__` / `constructor` / `prototype` could
  // pollute downstream consumers depending on orm-client internals.
  if (alias === '__proto__' || alias === 'constructor' || alias === 'prototype') {
    throw new PothosValidationError(
      `Field alias '${alias}' is reserved and cannot be used on a prisma-next-backed field.`,
    );
  }

  const op = ext[PRISMA_NEXT_FIELD_OP] as PrismaNextFieldOp | undefined;
  if (op) {
    switch (op.kind) {
      case 'sameRow': {
        if (op.select) {
          for (const col of op.select) {
            out.columns.add(col);
          }
        }
        if (!selection.selectionSet) {
          return;
        }
        const variantType = info.schema.getType(op.typeName);
        if (!variantType) {
          return;
        }
        // Route through mapField so the variant type's own
        // `pothosIndirectInclude` is honored.
        const sub = mapField(variantType, selection, info, config, context, false);
        mergeSelection(out, sub);
        return;
      }
      case 'include':
        addBranch(
          out,
          op.relationName,
          op.isToMany,
          alias,
          buildIncludeBranch(field, selection, info, config, context, op),
        );
        return;
      case 'paginatedInclude': {
        // Resolve args once and share with the totalCount branch —
        // resolution does a full arg walk + variable substitution.
        const paginatedArgs = getMappedArgumentValues(field, selection, context, info) as Record<
          string,
          unknown
        >;
        addBranch(
          out,
          op.relationName,
          true,
          alias,
          buildPaginatedIncludeBranch(field, selection, info, config, context, op, paginatedArgs),
        );
        // Drop a synthetic count() under the same relation when the
        // client selected totalCount on this query. Reuses the
        // connection's refine so the count reflects the same filtered
        // set as the paginated branch.
        if (
          op.totalCountAlias &&
          selectionSetIncludesField(selection.selectionSet, 'totalCount', info)
        ) {
          const rel = getOrCreateRelation(out, op.relationName, true);
          if (!rel.counts.has(op.totalCountAlias)) {
            rel.counts.set(op.totalCountAlias, {
              args: paginatedArgs,
              ...(op.refine !== undefined ? { refine: op.refine } : {}),
            });
          }
        }
        return;
      }
      case 'count': {
        const rel = getOrCreateRelation(out, op.relationName, true);
        if (rel.counts.has(alias)) {
          throw new PothosValidationError(
            `Duplicate alias "${alias}" for relationCount "${op.relationName}"`,
          );
        }
        const args = getMappedArgumentValues(field, selection, context, info) as Record<
          string,
          unknown
        >;
        rel.counts.set(alias, {
          args,
          ...(op.where !== undefined ? { where: op.where } : {}),
        });
        return;
      }
      case 'aggregate': {
        const rel = getOrCreateRelation(out, op.relationName, true);
        if (rel.aggregates.has(alias)) {
          throw new PothosValidationError(
            `Duplicate alias "${alias}" for relationAggregate "${op.relationName}"`,
          );
        }
        const args = getMappedArgumentValues(field, selection, context, info) as Record<
          string,
          unknown
        >;
        rel.aggregates.set(alias, {
          args,
          aggregate: op.aggregate,
          ...(op.where !== undefined ? { where: op.where } : {}),
        });
        return;
      }
      default: {
        const exhaust: never = op;
        throw new PothosValidationError(
          `Unknown PrismaNextFieldOp kind: ${(exhaust as { kind?: string }).kind}`,
        );
      }
    }
  }

  // Scalar / computed field column dependencies:
  //   pothosExposedField — core sets this on every `t.exposeX(name, …)`.
  //   pothosOptions.select — typed `select` augmentation from t.field({ select, resolve }).
  const exposed = ext[POTHOS_EXPOSED_FIELD];
  if (typeof exposed === 'string') {
    out.columns.add(exposed);
  }
  const opts = ext[POTHOS_FIELD_OPTIONS] as
    | {
        select?: readonly string[] | ((args: unknown, ctx: unknown) => readonly string[]);
      }
    | undefined;
  if (opts?.select !== undefined) {
    let cols: readonly string[];
    if (typeof opts.select === 'function') {
      const args = getMappedArgumentValues(field, selection, context, info) as Record<
        string,
        unknown
      >;
      cols = opts.select(args, context) ?? [];
    } else if (Array.isArray(opts.select)) {
      cols = opts.select;
    } else {
      cols = [];
    }
    for (const col of cols) {
      if (typeof col === 'string') {
        out.columns.add(col);
      }
    }
  }
}

function buildIncludeBranch(
  field: GraphQLField<unknown, unknown>,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  op: IncludeFieldOp,
) {
  const args = getMappedArgumentValues(field, selection, context, info) as Record<string, unknown>;
  const innerType = getNamedType(field.type);
  const inner =
    isObjectType(innerType) || isInterfaceType(innerType)
      ? mapField(innerType, selection, info, config, context, false)
      : emptySelection();
  return {
    args,
    parentFkColumns: getRelationLocalFields(config.contract, op.parentModel, op.relationName),
    inner,
    ...(op.refine !== undefined ? { refine: op.refine } : {}),
  };
}

function buildPaginatedIncludeBranch(
  field: GraphQLField<unknown, unknown>,
  selection: FieldNode,
  info: GraphQLResolveInfo,
  config: PothosPrismaNextConfig,
  context: object,
  op: PaginatedIncludeFieldOp,
  preResolvedArgs?: Record<string, unknown>,
) {
  const args =
    preResolvedArgs ??
    (getMappedArgumentValues(field, selection, context, info) as Record<string, unknown>);
  const connectionType = getNamedType(field.type);
  const cursorCols: readonly string[] = typeof op.cursor === 'string' ? [op.cursor] : op.cursor;

  // 1. Descend through any `pothosIndirectInclude` on the connection
  //    type itself (e.g. plugin-errors wrapping the return as a
  //    result-union).
  // 2. Walk the field-op's connection paths (`[['nodes'], ['edges', 'node']]`).
  // 3. Map the row type's selection set, honoring its own
  //    `pothosIndirectInclude` if present.
  let inner: PrismaNextSelection = emptySelection();
  for (const col of cursorCols) {
    inner.columns.add(col);
  }
  if (isObjectType(connectionType) || isInterfaceType(connectionType)) {
    const { pothosIndirectInclude } = (connectionType.extensions ?? {}) as {
      pothosIndirectInclude?: IndirectInclude;
    };
    const typeIndirectPaths =
      pothosIndirectInclude?.paths ??
      (pothosIndirectInclude?.path ? [pothosIndirectInclude.path] : undefined);

    const descend = (
      descendedType: GraphQLNamedType,
      descendedField: FieldNode,
      descendedDeferred: boolean,
    ) => {
      resolveIndirectIncludePaths(
        descendedType,
        info,
        descendedField,
        [],
        op.paths as { type?: string; name: string }[][],
        [],
        (innerType, innerField) => {
          const sub = mapField(innerType, innerField, info, config, context, descendedDeferred);
          inner = mergeSelection(inner, sub);
        },
        descendedDeferred,
      );
    };

    if (typeIndirectPaths && typeIndirectPaths.length > 0) {
      resolveIndirectIncludePaths(
        connectionType,
        info,
        selection,
        [],
        typeIndirectPaths,
        [],
        (descendedType, descendedField, _path, descendedDeferred) => {
          descend(descendedType, descendedField, descendedDeferred);
        },
      );
    } else if (pothosIndirectInclude) {
      const resolvedType = info.schema.getType(pothosIndirectInclude.getType());
      if (resolvedType) {
        descend(resolvedType, selection, false);
      }
    } else {
      descend(connectionType, selection, false);
    }
  }

  return {
    args,
    parentFkColumns: getRelationLocalFields(config.contract, op.parentModel, op.relationName),
    inner,
    pagination: {
      cursor: op.cursor,
      ...(op.defaultSize !== undefined ? { defaultSize: op.defaultSize } : {}),
      ...(op.maxSize !== undefined ? { maxSize: op.maxSize } : {}),
    },
    ...(op.refine !== undefined ? { refine: op.refine } : {}),
  };
}

function getRelationLocalFields(
  contract: AnyContract,
  parentModel: string,
  relationName: string,
): readonly string[] {
  const modelDef = (contract as { models: Record<string, unknown> }).models[parentModel] as
    | {
        relations?: Record<
          string,
          { cardinality?: string; on?: { localFields?: readonly string[] } }
        >;
      }
    | undefined;
  const rel = modelDef?.relations?.[relationName];
  // M:N future-check. `isToManyCardinality` accepts M:N at the type
  // level but the contract has no `on.localFields` for junctions yet.
  // When M:N lands, this needs the junction's local/target columns or
  // depth-2+ stitching silently breaks.
  if (rel && rel.cardinality === 'M:N') {
    throw new PothosValidationError(
      `Relation '${parentModel}.${relationName}' is M:N — junction-table relations aren't supported yet. ` +
        'Track upstream contract shape; this plugin needs the junction columns to do FK augmentation.',
    );
  }
  return rel?.on?.localFields ?? [];
}

// To-one relations can't carry multiple branches — the orm returns
// one row, so sibling aliases would each want their own refined view
// of the same row.
function addBranch(
  out: PrismaNextSelection,
  relationName: string,
  isToMany: boolean,
  alias: string,
  branch: import('./selection').BranchSelection,
) {
  const rel = getOrCreateRelation(out, relationName, isToMany);
  if (!isToMany && rel.branches.size > 0) {
    throw new PothosValidationError(
      `Relation "${relationName}" is to-one — only one branch allowed, got alias "${alias}" plus ${[...rel.branches.keys()].map((a) => `"${a}"`).join(', ')}.`,
    );
  }
  if (rel.branches.has(alias)) {
    throw new PothosValidationError(`Duplicate alias "${alias}" for relation "${relationName}"`);
  }
  rel.branches.set(alias, branch);
}

function resolveIndirectIncludePaths(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  pathPrefix: { type?: string; name: string }[],
  includePaths: { type?: string; name: string }[][],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[], deferred: boolean) => void,
  deferred?: boolean,
) {
  // Fresh visited-set per top-level call so concurrent walks of the
  // same info don't interfere.
  const visited = new Set<string>();
  for (const includePath of includePaths) {
    if (pathPrefix.length > 0) {
      resolveIndirectInclude(
        type,
        info,
        selection,
        [...pathPrefix, ...includePath],
        path,
        resolve,
        deferred,
        visited,
      );
    } else {
      resolveIndirectInclude(type, info, selection, includePath, path, resolve, deferred, visited);
    }
  }
}

function resolveIndirectInclude(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: { type?: string; name: string }[],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[], deferred: boolean) => void,
  deferred = false,
  visited: Set<string> = new Set(),
) {
  if (includePath.length === 0) {
    resolve(type, selection as FieldNode, path, deferred);
    return;
  }
  const [include, ...rest] = includePath;
  if (!selection.selectionSet || !include) {
    return;
  }

  for (const sel of selection.selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        if (
          !fieldSkipped(info, sel) &&
          sel.name.value === include.name &&
          (isObjectType(type) || isInterfaceType(type))
        ) {
          const returnType = getNamedType(type.getFields()[sel.name.value]!.type);
          resolveIndirectInclude(
            returnType,
            info,
            sel,
            rest,
            [...path, sel.alias?.value ?? sel.name.value],
            resolve,
            deferred,
            visited,
          );
        }
        continue;
      case Kind.FRAGMENT_SPREAD: {
        const name = sel.name.value;
        if (visited.has(name)) {
          continue;
        }
        const fragment = info.fragments[name];
        if (!fragment) {
          continue;
        }
        if (!include.type || fragment.typeCondition.name.value === include.type) {
          visited.add(name);
          resolveIndirectInclude(
            include.type ? info.schema.getType(include.type)! : type,
            info,
            fragment,
            includePath,
            path,
            resolve,
            deferred || isDeferredFragment(sel, info),
            visited,
          );
          visited.delete(name);
        }
        continue;
      }
      case Kind.INLINE_FRAGMENT:
        if (!sel.typeCondition || !include.type || sel.typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            sel.typeCondition ? info.schema.getType(sel.typeCondition.name.value)! : type,
            info,
            sel,
            includePath,
            path,
            resolve,
            deferred || isDeferredFragment(sel, info),
            visited,
          );
        }
        continue;
      default:
        throw new PothosValidationError(
          `Unsupported selection kind ${(sel as { kind: string }).kind}`,
        );
    }
  }
}

function getModelNameForType(type: GraphQLNamedType): string | undefined {
  const ext = (type.extensions ?? {}) as Record<string, unknown>;
  return ext[PRISMA_NEXT_MODEL] as string | undefined;
}

function fieldSkipped(info: GraphQLResolveInfo, selection: FieldNode): boolean {
  // Short-circuit on directive-less fields — getDirectiveValues
  // allocates per call.
  if (!selection.directives?.length) {
    return false;
  }
  const skip = getDirectiveValues(GraphQLSkipDirective, selection, info.variableValues);
  if (skip?.if === true) {
    return true;
  }
  const include = getDirectiveValues(GraphQLIncludeDirective, selection, info.variableValues);
  if (include?.if === false) {
    return true;
  }
  return false;
}

function isDeferredFragment(
  node: FragmentSpreadNode | InlineFragmentNode,
  info: GraphQLResolveInfo,
): boolean {
  if (!node.directives?.length) {
    return false;
  }
  const deferDirective = info.schema.getDirective('defer');
  if (!deferDirective) {
    return false;
  }
  const defer = getDirectiveValues(deferDirective, node, info.variableValues);
  return !!defer && defer.if !== false;
}
