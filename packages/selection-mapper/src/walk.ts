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
  type GraphQLNamedType,
  type GraphQLSchema,
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
  matchesForModel,
  modelOf,
  normalizeInclude,
  resolveType,
} from './matches.js';
import type { NodeBase } from './node.js';
import type {
  Adapter,
  EntryOptions,
  NestedSelection,
  Position,
  SelectFn,
  Walk,
  WalkedType,
} from './types.js';

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
export function enterLoaded<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  type: GraphQLNamedType,
) {
  const { adapter } = walk;
  const selection = adapter.typeSelection(type);

  if (selection) {
    adapter.merge(walk.root, adapter.withoutConflicts(walk.root, selection));
  }

  return walk;
}

/** The empty query tree a walk of `type` starts from, or a validation error when it has no model. */
function rootNode<M, Map, N extends NodeBase<M>>(
  adapter: Adapter<M, Map, N>,
  schema: GraphQLSchema,
  type: GraphQLNamedType,
): N {
  const model = modelOf(adapter, schema, type);

  if (!model) {
    throw new PothosValidationError(`Expected ${resolveType(schema, type).name} to have a model`);
  }

  return adapter.createNode(model);
}

/**
 * The root walk of an entry point. `replayable` records every merge into the root (`Walk.merges`)
 * so `queryFromWalk` can rebuild the query with a caller's selection ahead of the walked plan;
 * only `walkFromInfo` needs that.
 */
export function createWalk<M, Map, N extends NodeBase<M>>(
  adapter: Adapter<M, Map, N>,
  options: WalkOptions<Map>,
  type: GraphQLNamedType,
  position?: Position,
  replayable?: boolean,
): Walk<M, Map, N> {
  const { context, info, initial, skipDeferredFragments } = options;
  const walk: Walk<M, Map, N> = {
    adapter,
    context,
    info,
    skipDeferred: skipDeferredFragments ?? adapter.skipDeferredFragments,
    root: rootNode(adapter, info.schema, type),
    mappings: {},
    position,
  };

  if (replayable) {
    walk.merges = [];
  }

  if (initial) {
    adapter.merge(walk.root, initial);
  }

  // Not entered: a type is entered when its selection set is walked (S-1).
  return walk;
}

/** What `createWalk` reads of an entry point's options. */
export type WalkOptions<Map> = Pick<
  EntryOptions<Map>,
  'context' | 'info' | 'initial' | 'skipDeferredFragments'
>;

/**
 * E-3: the walk beneath one nested selection, which carries the parent's adapter, context, info
 * and deferred setting and records into the invocation's own mappings. It hangs beneath the field
 * whose select function made it, so that field's position is where the child walk is.
 */
function createNestedWalk<M, Map, N extends NodeBase<M>>(
  parent: Walk<M, Map, N>,
  type: GraphQLNamedType,
  mappings: Mappings,
  position: Position,
): Walk<M, Map, N> {
  const { adapter, context, info, skipDeferred } = parent;

  return {
    adapter,
    context,
    info,
    skipDeferred,
    root: rootNode(adapter, info.schema, type),
    mappings,
    position,
  };
}

/** S-1. */
function enter<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  type: GraphQLNamedType,
) {
  const selection = walk.adapter.typeSelection(type);

  if (selection) {
    walk.adapter.merge(node, selection);
    walk.merges?.push({ kind: 'type', map: selection });
  }
}

/**
 * S-7: merges the type-level selection of `variant` when a fragment moves the walk from `type` to
 * another type of the same model, so the variant's resolvers find what its selection promises.
 * Unlike a field-level select, a type-level selection has no per-field fallback, so relation
 * arguments or extras that conflict with what is already selected are an error.
 */
function enterVariant<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  type: WalkedType,
  variant: WalkedType,
) {
  const selection = walk.adapter.typeSelection(variant);

  if (!selection) {
    return;
  }

  mergeVariant(walk.adapter, node, type, variant, selection);
  walk.merges?.push({ kind: 'variant', type, variant, map: selection });
}

/** S-7 for one variant selection: rejected as an error when it conflicts with the node. */
export function mergeVariant<M, Map, N extends NodeBase<M>>(
  adapter: Adapter<M, Map, N>,
  node: N,
  type: WalkedType,
  variant: WalkedType,
  selection: Map,
) {
  const conflict = adapter.typeLevelConflict(node, selection);

  if (conflict) {
    switch (conflict.kind) {
      case 'relation':
        throw new PothosValidationError(
          `Type-level selections of ${type.name} and ${variant.name} conflict on relation "${conflict.name}". Move the relation arguments to a field-level select on one of the types.`,
        );
      case 'extra':
        throw new PothosValidationError(
          `Type-level selections of ${type.name} and ${variant.name} conflict on extra "${conflict.name}". Define the extra with the same function on both types, or move it to a field-level select on one of the types.`,
        );
      default: {
        const unknown: never = conflict.kind;

        throw new PothosValidationError(`Unknown type-level conflict ${unknown as string}`);
      }
    }
  }

  adapter.merge(node, selection);
}

/**
 * One selection to walk into a node, before any indirect include on `type` is followed: the
 * selection sets of `fieldNodes` (every node selecting one field), walked as `type`.
 */
interface UnresolvedFieldWalk {
  type: GraphQLNamedType;
  fieldNodes: readonly FieldNode[];
  indirectPath: string[];
  deferred: boolean;
}

/**
 * The same selection after `resolveFieldWalk` followed the include: the type whose fields are
 * walked, and the selection sets to walk on it (none when a deferred fragment is skipped).
 */
interface ResolvedFieldWalk {
  type: WalkedType;
  selectionSets: (readonly SelectionNode[])[];
  indirectPath: string[];
}

/**
 * E-4, S-1, S-8: walks every selection of `walks` into `node`. The types the selections are
 * walked as, and the variants their fragments move to, are all entered before any field is
 * merged, so type-level selections are settled first and the plan does not depend on which
 * selection comes first: neither the occurrence of a field (W-1) nor the path match (W-11).
 */
export function walkFieldWalks<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  walks: UnresolvedFieldWalk[],
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
function resolveFieldWalk<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  { type, fieldNodes, indirectPath, deferred }: UnresolvedFieldWalk,
): ResolvedFieldWalk[] {
  // Every node selects the same field.
  if (fieldNodes.length === 0 || fieldNodes[0].name.value.startsWith('__')) {
    return [];
  }

  const { info, adapter } = walk;
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
    deferred && walk.skipDeferred
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
function enterVariants<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  type: WalkedType,
  selections: readonly SelectionNode[],
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      continue;
    }

    const fragment = applicableFragment(walk, selection);

    if (!fragment || expandedBefore(visited, type.name, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(walk, type, fragment);

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
function walkSelections<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
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

    const fragment = applicableFragment(walk, selection);

    if (!fragment || expandedBefore(visited, `${type.name}:${fieldsApply}`, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(walk, type, fragment);

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
function applicableFragment<M, Map, N extends NodeBase<M>>(
  { info, skipDeferred }: Walk<M, Map, N>,
  selection: SelectionNode,
): Fragment | undefined {
  let fragment: Fragment;

  switch (selection.kind) {
    case Kind.FRAGMENT_SPREAD:
      fragment = info.fragments[selection.name.value];
      break;
    case Kind.INLINE_FRAGMENT:
      fragment = selection;
      break;
    // A field: the callers walk those themselves and never reach here.
    default:
      throw new PothosValidationError(`Unsupported selection kind ${selection.kind}`);
  }

  if (isSkipped(info, selection) || (skipDeferred && isDeferred(info, selection))) {
    return undefined;
  }

  return fragment;
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
function fragmentTypeOf<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  type: WalkedType,
  fragment: Fragment,
): WalkedType | undefined {
  if (!fragment.typeCondition) {
    return type;
  }

  const condition = walk.info.schema.getType(fragment.typeCondition.name.value)!;

  if (condition === type) {
    return type;
  }

  if (isInterfaceType(condition) && type.getInterfaces().includes(condition)) {
    return type;
  }

  if (
    isInterfaceType(type) &&
    (isObjectType(condition) || isInterfaceType(condition)) &&
    walk.adapter.modelFor(condition) === walk.adapter.modelFor(type)
  ) {
    return condition;
  }

  return undefined;
}

/** S-2..S-6: merges what `fieldNode` (a field of `type`) selects into `node`. */
export function applyField<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  type: WalkedType,
  fieldNode: FieldNode,
  indirectPath: string[],
) {
  const { info, context, adapter } = walk;
  const name = fieldNode.name.value;

  if (name.startsWith('__') || isSkipped(info, fieldNode)) {
    return;
  }

  const field = type.getFields()[name];

  if (!field) {
    throw new PothosValidationError(`Unknown field ${name} on ${type.name}`);
  }

  const selection = adapter.fieldSelection(field, type);

  if (!selection) {
    return;
  }

  const alias = fieldNode.alias?.value ?? name;
  const key = `${type.name}@${indirectPath.length > 0 ? `${indirectPath.join('.')}.` : ''}${alias}`;

  if (typeof selection !== 'function') {
    mergeField(walk, node, key, alias, selection, NONE);

    return;
  }

  // D-7: where this field is, linked to where the walk it was found in hangs. One link, built
  // once per select invocation; nothing walks it unless the adapter's callback asks.
  const position: Position = { parent: walk.position, type, field, node: fieldNode };
  // This invocation's mapping; every nested walk it makes records into `mapping.nested`, which
  // stays invisible to the walk until the invocation's map is accepted.
  const mapping: Invocation = { nested: {}, position };
  const args = getMappedArgumentValues(field, fieldNode, context, info);
  const select = selection as SelectFn<Map>;

  // S-6: the select runs as soon as its own arguments are known; only its merge waits (A-3).
  const map = isThenable(args)
    ? args.then((mapped) => runSelect(walk, select, mapped, position, mapping))
    : runSelect(walk, select, args, position, mapping);

  if (isThenable(map)) {
    chain(walk, map as PromiseLike<Map | false | null | undefined>, (resolved) =>
      mergeField(walk, node, key, alias, resolved, mapping),
    );
  } else {
    mergeField(walk, node, key, alias, map, mapping);
  }
}

function runSelect<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  select: SelectFn<Map>,
  args: object,
  position: Position,
  mapping: Invocation,
) {
  return select(
    args,
    walk.context,
    nestedSelectionFor(walk, args, position, mapping),
    getNodeFor(walk, position),
    position,
  );
}

/**
 * A field the way the document names it, for an error message: the type it was walked on and its
 * own name, with its alias when the document renamed it. The mapping key cannot say this — it
 * holds the alias in place of the name, under the alias path of any indirect include above it.
 */
function fieldName({ type, node }: Position) {
  const name = `${type.name}.${node.name.value}`;

  return node.alias ? `${name} (selected as "${node.alias.value}")` : name;
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
function mergeField<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  node: N,
  key: string,
  alias: string,
  map: Map | false | null | undefined,
  mapping: Invocation,
) {
  if (!(map && walk.adapter.compatible(node, map, true, key, alias))) {
    return;
  }

  walk.adapter.merge(node, map, key, alias);

  if (mapping.pending) {
    // Only a select invocation can be pending, and every one of those has a position.
    throw new PothosValidationError(
      `The selection function of ${fieldName(mapping.position!)} returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.`,
    );
  }

  walk.merges?.push({ kind: 'field', key, alias, map, mapping });
  walk.mappings[key] = unionMappings(walk.mappings[key], mapping);
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

  return into.position === undefined ? { nested } : { nested, position: into.position };
}

/** E-3: the nested selection callback of one select invocation. */
function nestedSelectionFor<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  args: object,
  position: Position,
  mapping: Invocation,
): NestedSelection<Map> {
  const { adapter, context, info } = walk;
  const { node: fieldNode } = position;

  return (rawQuery, pathOrInclude, typeName) => {
    const returnType = getNamedType(position.field.type);
    const include = Array.isArray(pathOrInclude)
      ? normalizeInclude(
          pathOrInclude,
          resolveType(info.schema, returnType),
          typeName ? info.schema.getType(typeName) : undefined,
          info.schema,
        )
      : pathOrInclude;
    const target = include ? info.schema.getType(include.getType())! : returnType;
    // `true` is the public "no query"; it never reaches an adapter.
    const query: MaybePromise<Map | null | undefined> =
      rawQuery === true
        ? undefined
        : typeof rawQuery === 'function'
          ? (
              rawQuery as (
                args: object,
                ctx: object,
                position: Position,
              ) => MaybePromise<Map | null | undefined>
            )(args, context, position)
          : rawQuery;

    if (!modelOf(adapter, info.schema, target)) {
      // A model-less field (a scalar, a type without a model) has nothing beneath it to plan:
      // the nested selection is the query alone, and nothing is recorded for it.
      return (query ?? ({} as Map)) as Map;
    }

    const child = createNestedWalk(walk, target, mapping.nested, position);

    try {
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
        const matches = matchesForModel(
          adapter,
          info.schema,
          findMatches(info, returnType, fieldNode, paths, {
            prefix: includeOf(returnType)?.path,
          }),
          target,
        );

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
        const asType = (type: GraphQLNamedType): UnresolvedFieldWalk => ({
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
    return child.pending ? (awaitNested(child, mapping) as Map) : adapter.serialize(child.root);
  };
}

/**
 * A-8: the promise of a nested selection whose walk is async, counted against its invocation
 * until it resolves. It is handled here, so a nested selection the invocation discards is never
 * an unhandled rejection: `mergeField` refuses the invocation instead. A rejection keeps the
 * count, since the invocation did not wait for it either; one that was awaited surfaces through
 * the invocation's own promise.
 */
function awaitNested<M, Map, N extends NodeBase<M>>(child: Walk<M, Map, N>, mapping: Invocation) {
  mapping.pending = (mapping.pending ?? 0) + 1;

  const result = child.pending!.then(() => child.adapter.serialize(child.root));

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
function mergeQuery<M, Map, N extends NodeBase<M>>(
  child: Walk<M, Map, N>,
  query: Map | null | undefined,
) {
  child.adapter.mergeQuery(child.root, query);
}

/**
 * E-5: the first field node selected at `path` beneath the field, seen through any wrapper on
 * the field's return type (an errors plugin result, for instance), whose own path leads to the
 * type the caller's path starts from. An empty path yields the field node itself, or the
 * wrapper's inner node.
 */
function getNodeFor<M, Map, N extends NodeBase<M>>(
  walk: Walk<M, Map, N>,
  { field, node: fieldNode }: Position,
) {
  const { info } = walk;

  return (path: string[]) => {
    const returnType = getNamedType(field.type);
    const matches = findMatches(info, returnType, fieldNode, [path.map((name) => ({ name }))], {
      prefix: includeOf(returnType)?.path,
    });

    return matches[0]?.field ?? null;
  };
}
