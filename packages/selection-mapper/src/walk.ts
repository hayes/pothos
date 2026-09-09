/**
 * The walk itself: S-1..S-9 (types, variants, fields, fragments), M-1..M-6 through the adapter,
 * E-3 nested selections, L-2 mapping records. Entry points live in entry.ts.
 */
import {
  getMappedArgumentValues,
  isThenable,
  type MaybePromise,
  PothosValidationError,
} from '@pothos/core';
import {
  type FieldNode,
  type FragmentDefinitionNode,
  type GraphQLField,
  type GraphQLNamedType,
  getNamedType,
  type InlineFragmentNode,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionNode,
} from 'graphql';
import { abandon, chain, noop } from './async.js';
import type { Mapping, Mappings } from './loader-map.js';
import {
  findMatches,
  includeOf,
  isDeferred,
  isSkipped,
  normalizeInclude,
  resolveType,
} from './matches.js';
import type { NodeBase } from './node.js';
import type { Adapter, Env, NestedSelection, SelectFn, Walk, WalkedType } from './types.js';

/** The mapping of a static selection: nothing can ever be recorded beneath one. */
const NONE: Mapping = Object.freeze({ nested: Object.freeze({}) as Mappings });

/**
 * One select invocation's mapping record while the invocation runs: `pending` counts the nested
 * selections it started whose walk is async and which have not resolved (A-8). Set only when a
 * nested walk is async, and removed once every one has resolved, so a recorded `Mapping` never
 * carries it and a synchronous invocation never touches it.
 */
interface Invocation extends Mapping {
  pending?: number;
}

/** E-2: the parent type's selection, minus what conflicts with the field, once it is merged. */
export function enterLoaded<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  type: GraphQLNamedType,
) {
  const { adapter } = walk.env;
  const selection = adapter.typeSelection(type);

  if (selection) {
    adapter.merge(walk.root, adapter.withoutConflicts(walk.root, selection));
  }

  return walk;
}

function serializeRoot<M, Map, X, N extends NodeBase<M>>(walk: Walk<M, Map, X, N>) {
  return walk.env.adapter.serialize(walk.root);
}

export function createWalk<M, Map, X, N extends NodeBase<M>>(
  env: Env<M, Map, X, N>,
  type: GraphQLNamedType,
  mappings: Mappings,
  extra?: X,
  initial?: Map,
  replayable?: boolean,
): Walk<M, Map, X, N> {
  const model = env.modelOf(type);

  if (!model) {
    throw new PothosValidationError(
      `Expected ${resolveType(env.info.schema, type).name} to have a model`,
    );
  }

  const walk: Walk<M, Map, X, N> = { env, root: env.adapter.createNode(model), mappings, extra };

  if (replayable) {
    walk.merges = [];
  }

  if (initial) {
    env.adapter.merge(walk.root, initial);
  }

  // Not entered: a type is entered when its selection set is walked (S-1).
  return walk;
}

/** S-1. */
function enter<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  type: GraphQLNamedType,
) {
  const selection = walk.env.adapter.typeSelection(type);

  if (selection) {
    walk.env.adapter.merge(node, selection);
    walk.merges?.push({ kind: 'type', map: selection });
  }
}

/**
 * S-7: merges the type-level selection of `variant` when a fragment moves the walk from `type` to
 * another type of the same model, so the variant's resolvers find what its selection promises.
 * Unlike a field-level select, a type-level selection has no per-field fallback, so relation
 * arguments or extras that conflict with what is already selected are an error.
 */
function enterVariant<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  type: WalkedType,
  variant: WalkedType,
) {
  const selection = walk.env.adapter.typeSelection(variant);

  if (!selection) {
    return;
  }

  mergeVariant(walk.env.adapter, node, type, variant, selection);
  walk.merges?.push({ kind: 'variant', type, variant, map: selection });
}

/** S-7 for one variant selection: rejected as an error when it conflicts with the node. */
export function mergeVariant<M, Map, X, N extends NodeBase<M>>(
  adapter: Adapter<M, Map, X, N>,
  node: N,
  type: WalkedType,
  variant: WalkedType,
  selection: Map,
) {
  const conflict = adapter.typeLevelConflict(node, selection);

  if (conflict?.kind === 'relation') {
    throw new PothosValidationError(
      `Type-level selections of ${type.name} and ${variant.name} conflict on relation "${conflict.name}". Move the relation arguments to a field-level select on one of the types.`,
    );
  }

  if (conflict) {
    throw new PothosValidationError(
      `Type-level selections of ${type.name} and ${variant.name} conflict on extra "${conflict.name}". Define the extra with the same function on both types, or move it to a field-level select on one of the types.`,
    );
  }

  adapter.merge(node, selection);
}

/**
 * One selection to walk into a node: the selection sets of `fieldNodes` (every node selecting one
 * field), walked as `type`.
 */
interface FieldWalk {
  type: GraphQLNamedType;
  fieldNodes: readonly FieldNode[];
  indirectPath: string[];
  deferred: boolean;
}

/** A `FieldWalk` resolved through any indirect include to the type whose fields are walked. */
interface ResolvedFieldWalk {
  type: WalkedType;
  selectionSets: (readonly SelectionNode[])[];
  indirectPath: string[];
}

/** E-4, S-1, S-8: `walkFieldWalks` for one selection. */
export function walkFields<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  type: GraphQLNamedType,
  fieldNodes: readonly FieldNode[],
  indirectPath: string[],
  deferred: boolean,
) {
  walkFieldWalks(walk, node, [{ type, fieldNodes, indirectPath, deferred }]);
}

/**
 * E-4, S-1, S-8: walks every selection of `walks` into `node`. The types the selections are
 * walked as, and the variants their fragments move to, are all entered before any field is
 * merged, so type-level selections are settled first and the plan does not depend on which
 * selection comes first: neither the occurrence of a field (W-1) nor the path match (W-11).
 */
export function walkFieldWalks<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  walks: FieldWalk[],
) {
  const resolved = walks.flatMap((fieldWalk) => resolveFieldWalk(walk, node, fieldWalk));

  for (const { type, selectionSets } of resolved) {
    enter(walk, node, type);

    const entered = new Set<string>();

    for (const selections of selectionSets) {
      enterVariants(walk, node, type, selections, entered);
    }
  }

  for (const { type, selectionSets, indirectPath } of resolved) {
    const walked = new Set<string>();

    for (const selections of selectionSets) {
      walkSelections(walk, node, type, selections, indirectPath, true, walked);
    }
  }
}

/**
 * E-4: the selections `fieldWalk` stands for once its type's indirect include is followed, in the
 * order they are walked. A type-level path yields one per match beneath the wrapper; a plain
 * include re-types the walk; anything but an object or interface type yields nothing.
 */
function resolveFieldWalk<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  { type, fieldNodes, indirectPath, deferred }: FieldWalk,
): ResolvedFieldWalk[] {
  // Every node selects the same field.
  if (fieldNodes.length === 0 || fieldNodes[0].name.value.startsWith('__')) {
    return [];
  }

  const { info, adapter } = walk.env;
  const include = includeOf(type);
  const beneath: ResolvedFieldWalk[] = [];

  if (include?.paths?.length || include?.path?.length) {
    for (const fieldNode of fieldNodes) {
      const matches = findMatches(info, type, fieldNode, include.paths ?? [include.path!], {
        path: indirectPath,
        deferred,
      });

      for (const match of matches) {
        beneath.push(
          ...resolveFieldWalk(walk, node, {
            type: match.type,
            fieldNodes: [match.field],
            indirectPath: match.path,
            deferred: match.deferred,
          }),
        );
      }
    }

    // The wrapper's own selection is planned only when the wrapper itself is backed by the model
    // being queried (a variant that also points at a nested field). A plain wrapper, or one backed
    // by another model, has nothing of its own to add to this query.
    if (adapter.modelFor(type) !== node.model) {
      return beneath;
    }
  } else if (include) {
    return resolveFieldWalk(walk, node, {
      type: info.schema.getType(include.getType())!,
      fieldNodes,
      indirectPath,
      deferred,
    });
  }

  if (!(isObjectType(type) || isInterfaceType(type))) {
    return beneath;
  }

  // A deferred selection is entered but, when deferred fragments are skipped, not walked.
  const selectionSets =
    deferred && walk.env.skipDeferred
      ? []
      : fieldNodes.flatMap((fieldNode) =>
          fieldNode.selectionSet ? [fieldNode.selectionSet.selections] : [],
        );

  return [...beneath, { type, selectionSets, indirectPath }];
}

type Fragment = FragmentDefinitionNode | InlineFragmentNode;

/**
 * Whether `fragment` was already expanded under `key` in the pass `visited` belongs to, recording
 * it if not. A named fragment spread more than once under the same type does the same work each
 * time, and a valid fragment DAG can spread the same fragment at every level, so expanding every
 * spread is exponential in its depth. Inline fragments cannot repeat.
 */
function expandedBefore(visited: Set<string>, key: string, fragment: Fragment): boolean {
  if (fragment.kind !== Kind.FRAGMENT_DEFINITION) {
    return false;
  }

  const id = `${key}:${fragment.name.value}`;

  if (visited.has(id)) {
    return true;
  }

  visited.add(id);

  return false;
}

/**
 * S-7 first pass: enters every same-model variant a fragment under `selections` moves the walk to,
 * before any field at `node` is merged, so a conflict between two type-level selections is
 * reported whichever order the fragments appear in and never depends on a field-level select.
 */
function enterVariants<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  type: WalkedType,
  selections: readonly SelectionNode[],
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      continue;
    }

    const fragment = applicableFragment(walk.env, selection);

    if (!fragment || expandedBefore(visited, type.name, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(walk.env, type, fragment);

    if (as && as !== type) {
      enterVariant(walk, node, type, as);
    }

    enterVariants(walk, node, as ?? type, fragment.selectionSet.selections, visited);
  }
}

/**
 * S-7 second pass: walks `selections` in document order, a fragment's fields where the fragment
 * appears. Fields apply to `node` unless the enclosing fragment cannot apply to `type`; nested
 * fragments are always classified against `type`, so one may narrow back to it.
 */
function walkSelections<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  type: WalkedType,
  selections: readonly SelectionNode[],
  indirectPath: string[],
  fieldsApply: boolean,
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      if (fieldsApply) {
        applyField(walk, node, type, selection, indirectPath);
      }

      continue;
    }

    const fragment = applicableFragment(walk.env, selection);

    if (!fragment || expandedBefore(visited, `${type.name}:${fieldsApply}`, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(walk.env, type, fragment);

    walkSelections(
      walk,
      node,
      as ?? type,
      fragment.selectionSet.selections,
      indirectPath,
      // An untyped fragment inherits; a typed one applies iff it can apply to `type`.
      fragment.typeCondition ? as !== undefined : fieldsApply,
      visited,
    );
  }
}

/**
 * The fragment a non-field selection stands for, or undefined when it does not apply: skipped by
 * a directive (S-2), or deferred (S-8).
 */
function applicableFragment<M, Map, X, N extends NodeBase<M>>(
  { info, skipDeferred }: Env<M, Map, X, N>,
  selection: SelectionNode,
): Fragment | undefined {
  if (selection.kind !== Kind.FRAGMENT_SPREAD && selection.kind !== Kind.INLINE_FRAGMENT) {
    throw new PothosValidationError(
      `Unsupported selection kind ${(selection as { kind: string }).kind}`,
    );
  }

  if (isSkipped(info, selection) || (skipDeferred && isDeferred(info, selection))) {
    return undefined;
  }

  return selection.kind === Kind.FRAGMENT_SPREAD ? info.fragments[selection.name.value] : selection;
}

/**
 * S-7: the type to walk `fragment` as while walking `type`, or undefined when the fragment cannot
 * apply to `type` (its fields are suppressed; nested fragments are still classified against
 * `type`). An untyped fragment inherits `type`. An object type accepts a fragment on itself or on
 * an interface it implements, walked as itself: a walk on an object type is a walk on rows of that
 * type (the field's own type, a pinned `typeName`, a node load), so a fragment on any other object
 * type cannot apply to them. An interface accepts a fragment on another type of the same model,
 * object or interface, walked as that type, so that type's own selection is planned for the rows
 * that resolve to it.
 */
function fragmentTypeOf<M, Map, X, N extends NodeBase<M>>(
  env: Env<M, Map, X, N>,
  type: WalkedType,
  fragment: Fragment,
): WalkedType | undefined {
  if (!fragment.typeCondition) {
    return type;
  }

  const condition = env.info.schema.getType(fragment.typeCondition.name.value)!;

  if (condition === type) {
    return type;
  }

  if (isInterfaceType(condition) && type.getInterfaces().includes(condition)) {
    return type;
  }

  if (
    isInterfaceType(type) &&
    (isObjectType(condition) || isInterfaceType(condition)) &&
    env.adapter.modelFor(condition) === env.adapter.modelFor(type)
  ) {
    return condition;
  }

  return undefined;
}

/** S-2..S-6: merges what `fieldNode` (a field of `type`) selects into `node`. */
export function applyField<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  type: WalkedType,
  fieldNode: FieldNode,
  indirectPath: string[],
) {
  const { info, context, adapter } = walk.env;
  const name = fieldNode.name.value;

  if (name.startsWith('__') || isSkipped(info, fieldNode)) {
    return;
  }

  const field = type.getFields()[name];

  if (!field) {
    throw new PothosValidationError(`Unknown field ${name} on ${type.name}`);
  }

  const selection = adapter.fieldSelection(field);

  if (!selection) {
    return;
  }

  const alias = fieldNode.alias?.value ?? name;
  const key = `${type.name}@${indirectPath.length > 0 ? `${indirectPath.join('.')}.` : ''}${alias}`;

  if (typeof selection !== 'function') {
    mergeField(walk, node, key, alias, selection, NONE);

    return;
  }

  // This invocation's mapping; every nested walk it makes records into `mapping.nested`, which
  // stays invisible to the walk until the invocation's map is accepted.
  const extra = adapter.callbackExtra?.(walk.extra, type, field, fieldNode);
  const mapping: Invocation = { nested: {}, extra };
  const args = getMappedArgumentValues(field, fieldNode, context, info);
  const select = selection as SelectFn<Map, X>;

  // S-6: the select runs as soon as its own arguments are known; only its merge waits (A-3).
  const map = isThenable(args)
    ? args.then((mapped) => runSelect(walk, field, fieldNode, select, mapped, extra, mapping))
    : runSelect(walk, field, fieldNode, select, args, extra, mapping);

  if (isThenable(map)) {
    chain(walk, map as PromiseLike<Map | false | null | undefined>, (resolved) =>
      mergeField(walk, node, key, alias, resolved, mapping),
    );
  } else {
    mergeField(walk, node, key, alias, map, mapping);
  }
}

function runSelect<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  field: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  select: SelectFn<Map, X>,
  args: object,
  extra: X | undefined,
  mapping: Mapping,
) {
  return select(
    args,
    walk.env.context,
    nestedSelectionFor(walk, field, fieldNode, args, extra, mapping),
    getNodeFor(walk, field, fieldNode),
    extra as X,
  );
}

/**
 * S-5, M-3, M-4, L-2: merges an accepted map and records its mapping, or does neither. A
 * rejected or falsy map records nothing, so the resolver loads its own data (L-3). This is the
 * only place a mapping is recorded.
 *
 * A-8: an invocation whose nested selection is still pending returned without awaiting it. Its
 * map cannot hold what the nested walk will select, so recording its mapping would claim data
 * the query never loads: the invocation is refused instead, and the pending walks (already
 * handled, see `awaitNested`) are left to settle unobserved. Checked after the merge, so a map
 * that embeds the pending promise is reported as that by the adapter.
 */
function mergeField<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  node: N,
  key: string,
  alias: string,
  map: Map | false | null | undefined,
  mapping: Invocation,
) {
  if (!(map && walk.env.adapter.compatible(node, map, true, key, alias))) {
    return;
  }

  walk.env.adapter.merge(node, map, key, alias);

  if (mapping.pending) {
    throw new PothosValidationError(
      `The selection function of ${key.replace('@', '.')} returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.`,
    );
  }

  walk.merges?.push({ kind: 'field', key, alias, map, mapping });

  if (walk.env.adapter.recordsMappings !== false) {
    walk.mappings[key] = unionMappings(walk.mappings[key], mapping);
  }
}

/**
 * Adopts the first mapping accepted for a key; a later accepted walk of the key deep-unions into
 * a copy, so a recorded mapping is never changed after the fact (a replay may accept a different
 * subset of the walks).
 */
export function unionMappings(into: Mapping | undefined, from: Mapping): Mapping {
  if (!into || into === NONE) {
    return from;
  }

  const nested: Mappings = { ...into.nested };

  for (const key of Object.keys(from.nested)) {
    nested[key] = unionMappings(nested[key], from.nested[key]);
  }

  return into.extra === undefined ? { nested } : { nested, extra: into.extra };
}

/** E-3: the nested selection callback of one select invocation. */
function nestedSelectionFor<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  field: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
  args: object,
  extra: X | undefined,
  mapping: Invocation,
): NestedSelection<Map, X> {
  const { env } = walk;
  const { info } = env;

  return (rawQuery, pathOrInclude, typeName) => {
    const returnType = getNamedType(field.type);
    const include = Array.isArray(pathOrInclude)
      ? normalizeInclude(
          pathOrInclude,
          resolveType(info.schema, returnType),
          typeName ? info.schema.getType(typeName) : undefined,
          info.schema,
        )
      : pathOrInclude;
    const target = include ? info.schema.getType(include.getType())! : returnType;
    const child = createWalk(env, target, mapping.nested, extra);

    try {
      // `true` is the public "no query"; it never reaches an adapter.
      const query: MaybePromise<Map | null | undefined> =
        rawQuery === true
          ? undefined
          : typeof rawQuery === 'function'
            ? (
                rawQuery as (
                  args: object,
                  ctx: object,
                  extra: X,
                ) => MaybePromise<Map | null | undefined>
              )(args, env.context, extra as X)
            : rawQuery;

      if (isThenable(query)) {
        chain(child, query as PromiseLike<Map | null | undefined>, (resolved) =>
          mergeQuery(child, resolved),
        );
      } else {
        mergeQuery(child, query);
      }

      const paths = include?.paths?.length
        ? include.paths
        : include?.path?.length
          ? [include.path]
          : undefined;

      if (paths) {
        // Each match is walked as its own type (W-11); the wrapper's selection set is not walked.
        const matches = findMatches(info, returnType, fieldNode, paths, {
          prefix: includeOf(returnType)?.path,
          targetType: target,
          modelOf: env.modelOf,
        });

        walkFieldWalks(
          child,
          child.root,
          matches.map((match) => ({
            type: match.type,
            fieldNodes: [match.field],
            indirectPath: match.path,
            deferred: match.deferred,
          })),
        );
      } else {
        const asType = (type: GraphQLNamedType): FieldWalk => ({
          type,
          fieldNodes: [fieldNode],
          indirectPath: [],
          deferred: false,
        });

        walkFieldWalks(child, child.root, [
          ...(target === returnType ? [] : [asType(target)]),
          asType(returnType),
        ]);
      }
    } catch (error) {
      abandon(child);
      throw error;
    }

    // A promise behind the declared synchronous type, as `finish` returns one (A-7).
    return child.pending ? (awaitNested(child, mapping) as Map) : serializeRoot(child);
  };
}

/**
 * A-8: the promise of a nested selection whose walk is async, counted against its invocation
 * until it resolves. It is handled here, so a nested selection the invocation discards is never
 * an unhandled rejection: `mergeField` refuses the invocation instead. A rejection keeps the
 * count, since the invocation did not wait for it either; one that was awaited surfaces through
 * the invocation's own promise.
 */
function awaitNested<M, Map, X, N extends NodeBase<M>>(
  child: Walk<M, Map, X, N>,
  mapping: Invocation,
) {
  mapping.pending = (mapping.pending ?? 0) + 1;

  const result = child.pending!.then(() => serializeRoot(child));

  result.then(() => {
    if (mapping.pending === 1) {
      delete mapping.pending;
    } else {
      mapping.pending! -= 1;
    }
  }, noop);

  return result;
}

/** E-3: the relation query of a nested selection, merged into the child's root by the adapter. */
function mergeQuery<M, Map, X, N extends NodeBase<M>>(
  child: Walk<M, Map, X, N>,
  query: Map | null | undefined,
) {
  child.env.adapter.mergeQuery(child.root, query);
}

/**
 * E-5: the first field node selected at `path` beneath the field, seen through any wrapper on
 * the field's return type (an errors plugin result, for instance), whose own path leads to the
 * type the caller's path starts from. An empty path yields the field node itself, or the
 * wrapper's inner node.
 */
function getNodeFor<M, Map, X, N extends NodeBase<M>>(
  walk: Walk<M, Map, X, N>,
  field: GraphQLField<unknown, unknown>,
  fieldNode: FieldNode,
) {
  const { info } = walk.env;

  return (path: string[]) => {
    const returnType = getNamedType(field.type);
    const matches = findMatches(info, returnType, fieldNode, [path.map((name) => ({ name }))], {
      prefix: includeOf(returnType)?.path,
    });

    return matches[0]?.field ?? null;
  };
}
