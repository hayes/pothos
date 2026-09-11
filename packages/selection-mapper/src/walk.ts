/**
 * The traversal: types, variants, fields and fragments read into a plan's merge list. The entry
 * points that drive it are the statics of `Plan` in plan.ts, which imports this module; the
 * `Plan` import below is a type import, so nothing here runs at import time and the pair is not a
 * runtime cycle.
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
  type FragmentSpreadNode,
  type GraphQLNamedType,
  getNamedType,
  type InlineFragmentNode,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionNode,
} from 'graphql';
import type { NodeBase } from './adapter.js';
import { EMPTY_MAPPING, type Mapping, unionMappings } from './loader-map.js';
import {
  collectSelectedFieldNames,
  findMatches,
  firstMatch,
  includeOf,
  isDeferred,
  isSkipped,
  matchesForModel,
  modelOf,
  normalizeInclude,
  resolveType,
} from './matches.js';
import type { Plan } from './plan.js';
import type { NestedSelection, Position, SelectFn, WalkedType } from './types.js';

/**
 * One select invocation's mapping record while the invocation runs: `pending` counts the nested
 * selections it started whose plan is async and has not resolved. Removed once every one has,
 * so a recorded `Mapping` never carries it and a synchronous invocation never touches it.
 */
interface Invocation extends Mapping {
  pending?: number;
}

/** Collects a type's type-level selection, once, before its fields are walked. */
function enter<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: GraphQLNamedType,
) {
  const selection = plan.adapter.typeSelection(type);

  if (selection) {
    plan.collect({ kind: 'type', query: selection });
  }
}

/**
 * Collects the type-level selection of `variant` when a fragment moves the plan from `type` to
 * another type of the same model, so the variant's resolvers find what its selection promises.
 * Whether the two selections can live in one node is decided when the plan is played.
 */
function enterVariant<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  variant: WalkedType,
) {
  const selection = plan.adapter.typeSelection(variant);

  if (selection) {
    plan.collect({ kind: 'variant', type, variant, query: selection });
  }
}

/**
 * One selection to walk into a plan, before any indirect include on `type` is followed: the
 * selection sets of `fieldNodes` (every node selecting one field), walked as `type`.
 */
export interface Branch {
  type: GraphQLNamedType;
  fieldNodes: readonly FieldNode[];
  indirectPath: string[];
  deferred: boolean;
}

/**
 * The same selection after `resolveBranch` followed the include: the type whose fields are
 * walked, and the selection sets to walk on it (none when a deferred fragment is skipped).
 */
interface ResolvedBranch {
  type: WalkedType;
  selectionSets: (readonly SelectionNode[])[];
  indirectPath: string[];
}

/**
 * Walks every branch into `plan`. The types the selections are walked as, and the variants their
 * fragments move to, are all collected before any field is, so type-level selections come first
 * in the merge list and the plan does not depend on which occurrence of a field, or which path
 * match, came first in the document.
 */
export function walkBranches<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  branches: Branch[],
) {
  const resolved = branches.flatMap((branch) => resolveBranch(plan, branch));
  const enteredTypes = new Set<WalkedType>();
  let firstType: WalkedType | undefined;

  for (const { type, selectionSets } of resolved) {
    // The plan is entered as the first type a match landed on, and every other one as a
    // same-model variant of it, so two type-level selections that conflict are reported here
    // exactly as they are when a fragment moves the plan between the same two types. A type two
    // matches share is entered once.
    if (!enteredTypes.has(type)) {
      enteredTypes.add(type);

      if (firstType) {
        enterVariant(plan, firstType, type);
      } else {
        firstType = type;
        enter(plan, type);
      }
    }

    const entered = new Set<string>();

    for (const selections of selectionSets) {
      enterVariants(plan, type, selections, entered);
    }
  }

  for (const { type, selectionSets, indirectPath } of resolved) {
    const walked = new Set<string>();

    for (const selections of selectionSets) {
      walkSelections(plan, type, selections, indirectPath, true, walked);
    }
  }
}

/**
 * The selections `branch` stands for once its type's indirect include is followed, in the order
 * they are walked. A type-level path yields one per match beneath the wrapper; a plain include
 * re-types the plan; anything but an object or interface type yields nothing.
 */
function resolveBranch<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  { type, fieldNodes, indirectPath, deferred }: Branch,
): ResolvedBranch[] {
  // Every node selects the same field.
  if (fieldNodes.length === 0 || fieldNodes[0].name.value.startsWith('__')) {
    return [];
  }

  const { info, adapter } = plan;
  const include = includeOf(type);
  const beneath: ResolvedBranch[] = [];

  if (include?.paths?.length || include?.path?.length) {
    for (const fieldNode of fieldNodes) {
      const matches = findMatches(info, type, fieldNode, include.paths ?? [include.path!], {
        path: indirectPath,
        deferred,
      });

      for (const match of matches) {
        beneath.push(
          ...resolveBranch(plan, {
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
    if (adapter.modelFor(type) !== plan.model) {
      return beneath;
    }
  } else if (include) {
    return resolveBranch(plan, {
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
    deferred && plan.skipDeferredFragments
      ? []
      : fieldNodes.flatMap((fieldNode) =>
          fieldNode.selectionSet ? [fieldNode.selectionSet.selections] : [],
        );

  return [...beneath, { type, selectionSets, indirectPath }];
}

type Fragment = FragmentDefinitionNode | InlineFragmentNode;

/**
 * Whether `fragment` was already expanded under `key` in the pass `visited` belongs to, recording
 * it if not. A valid fragment DAG can spread the same fragment at every level, so expanding every
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
 * First pass: enters every same-model variant a fragment under `selections` moves the plan to,
 * before any field is merged, so a conflict between two type-level selections is reported
 * whichever order the fragments appear in and never depends on a field-level select.
 */
function enterVariants<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  selections: readonly SelectionNode[],
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      continue;
    }

    const fragment = applicableFragment(plan, selection);

    if (!fragment || expandedBefore(visited, type.name, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(plan, type, fragment);

    if (as && as !== type) {
      enterVariant(plan, type, as);
    }

    enterVariants(plan, as ?? type, fragment.selectionSet.selections, visited);
  }
}

/**
 * Second pass: walks `selections` in document order, a fragment's fields where the fragment
 * appears. Fields apply unless the enclosing fragment cannot apply to `type`; nested fragments
 * are always classified against `type`, so one may narrow back to it.
 */
function walkSelections<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  selections: readonly SelectionNode[],
  indirectPath: string[],
  fieldsApply: boolean,
  visited: Set<string>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      if (fieldsApply) {
        walkField(plan, type, selection, indirectPath);
      }

      continue;
    }

    const fragment = applicableFragment(plan, selection);

    if (!fragment || expandedBefore(visited, `${type.name}:${fieldsApply}`, fragment)) {
      continue;
    }

    const as = fragmentTypeOf(plan, type, fragment);

    walkSelections(
      plan,
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
 * a directive, or deferred while the plan skips deferred fragments.
 */
function applicableFragment<Model, Query, NodeType extends NodeBase<Model>>(
  { info, skipDeferredFragments }: Plan<Model, Query, NodeType>,
  selection: FragmentSpreadNode | InlineFragmentNode,
): Fragment | undefined {
  if (isSkipped(info, selection) || (skipDeferredFragments && isDeferred(info, selection))) {
    return undefined;
  }

  return selection.kind === Kind.FRAGMENT_SPREAD ? info.fragments[selection.name.value] : selection;
}

/**
 * The type to walk `fragment` as while walking `type`, or undefined when the fragment cannot
 * apply to `type` (its fields are suppressed; nested fragments are still classified against
 * `type`). An untyped fragment inherits `type`. An object type accepts a fragment on itself or on
 * an interface it implements, walked as itself: a plan on an object type is a plan on rows of that
 * type, so a fragment on any other object type cannot apply to them. An interface accepts a
 * fragment on another type of the same model, walked as that type, so that type's own selection
 * is planned for the rows that resolve to it.
 */
function fragmentTypeOf<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  fragment: Fragment,
): WalkedType | undefined {
  if (!fragment.typeCondition) {
    return type;
  }

  const condition = plan.info.schema.getType(fragment.typeCondition.name.value)!;

  if (condition === type) {
    return type;
  }

  if (isInterfaceType(condition) && type.getInterfaces().includes(condition)) {
    return type;
  }

  if (
    isInterfaceType(type) &&
    (isObjectType(condition) || isInterfaceType(condition)) &&
    plan.adapter.modelFor(condition) === plan.adapter.modelFor(type)
  ) {
    return condition;
  }

  return undefined;
}

/** Collects what `fieldNode` (a field of `type`) selects. */
export function walkField<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  fieldNode: FieldNode,
  indirectPath: string[],
) {
  const { info, context, adapter } = plan;
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
    collectField(plan, key, alias, selection, EMPTY_MAPPING);

    return;
  }

  // Where this field is, linked to where the plan it was found in hangs. One link, built once per
  // select invocation; nothing walks it unless the adapter's callback asks.
  const position: Position = { parent: plan.position, type, field, node: fieldNode };
  // This invocation's mapping; every nested plan it makes records into `mapping.nested`, which
  // stays invisible to the plan until the invocation's query is accepted.
  const mapping: Invocation = { nested: {}, position };
  const args = getMappedArgumentValues(field, fieldNode, context, info);
  const select = selection as SelectFn<Query>;

  // The select runs as soon as its own arguments are known; only its merge waits.
  const query = isThenable(args)
    ? args.then((mapped) => runSelect(plan, select, mapped, position, mapping))
    : runSelect(plan, select, args, position, mapping);

  if (isThenable(query)) {
    plan.chain(query as PromiseLike<Query | false | null | undefined>, (resolved) =>
      collectField(plan, key, alias, resolved, mapping),
    );
  } else {
    collectField(plan, key, alias, query, mapping);
  }
}

function runSelect<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  select: SelectFn<Query>,
  args: object,
  position: Position,
  mapping: Invocation,
) {
  return select(
    args,
    plan.context,
    nestedSelectionFor(plan, args, position, mapping),
    selectedFieldNodeFor(plan, position),
    position,
  );
}

/**
 * A field the way the document names it, for an error message. The mapping key cannot say this:
 * it holds the alias in place of the name, under the alias path of any indirect include above it.
 */
function fieldName({ type, node }: Position) {
  const name = `${type.name}.${node.name.value}`;

  return node.alias ? `${name} (selected as "${node.alias.value}")` : name;
}

/**
 * Collects a field's query with the mapping to record if a play takes it. A falsy query is
 * collected as nothing, so the resolver loads its own data; whether the query fits, and so
 * whether the mapping is ever recorded, is `play`'s decision.
 *
 * An invocation whose nested selection is still pending returned without awaiting it, so its
 * query cannot hold what the nested plan will select and recording its mapping would claim data
 * the query never loads. It is refused instead, and the pending plans (already handled, see
 * `awaitNested`) are left to settle unobserved.
 */
function collectField<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  key: string,
  alias: string,
  query: Query | false | null | undefined,
  mapping: Invocation,
) {
  if (!query) {
    return;
  }

  if (mapping.pending) {
    // Only a select invocation can be pending, and every one of those has a position.
    throw new PothosValidationError(
      `The selection function of ${fieldName(mapping.position!)} returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.`,
    );
  }

  plan.collect({ kind: 'field', key, alias, query, mapping });
}

/** The nested selection callback of one select invocation. */
function nestedSelectionFor<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  args: object,
  position: Position,
  mapping: Invocation,
): NestedSelection<Query> {
  const { adapter, context, info } = plan;
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
    const query: MaybePromise<Query | null | undefined> =
      rawQuery === true
        ? undefined
        : typeof rawQuery === 'function'
          ? (
              rawQuery as (
                args: object,
                ctx: object,
                position: Position,
              ) => MaybePromise<Query | null | undefined>
            )(args, context, position)
          : rawQuery;

    if (!modelOf(adapter, info.schema, target)) {
      // A model-less field (a scalar, a type without a model) has nothing beneath it to plan:
      // the nested selection is the query alone, and nothing is recorded for it.
      return (query ?? ({} as Query)) as Query;
    }

    const child = plan.nested(target, position);

    try {
      if (isThenable(query)) {
        child.chain(query as PromiseLike<Query | null | undefined>, (resolved) =>
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
        // Each match is walked as its own type; the wrapper's selection set is not walked.
        const matches = matchesForModel(
          adapter,
          info.schema,
          findMatches(info, returnType, fieldNode, paths, {
            prefix: includeOf(returnType)?.path,
          }),
          target,
        );

        walkBranches(
          child,
          matches.map((match) => ({
            // As `Plan.fromInfo` does for its own paths: a matched type with a model is walked
            // with it, and one without (an interface, a wrapper) as the type asked for, so its
            // fields are found and a fragment narrowing to it applies.
            type: modelOf(adapter, info.schema, match.type) ? match.type : target,
            fieldNodes: [match.field],
            indirectPath: match.path,
            deferred: match.deferred,
          })),
        );
      } else {
        const asType = (type: GraphQLNamedType): Branch => ({
          type,
          fieldNodes: [fieldNode],
          indirectPath: [],
          deferred: false,
        });

        walkBranches(child, [
          ...(target === returnType ? [] : [asType(target)]),
          asType(returnType),
        ]);
      }
    } catch (error) {
      child.abandon();
      throw error;
    }

    // A promise behind the declared synchronous type, as `finish` returns one.
    return child.pending ? (awaitNested(child, mapping) as Query) : queryNested(child, mapping);
  };
}

/**
 * The promise of a nested selection whose plan is async, counted against its invocation until it
 * settles. Both outcomes clear the count, so an invocation can catch a failure and retry.
 * Rejections are handled here so a discarded selection does not create an unhandled rejection.
 * A failed child publishes no mappings; fields it did not load can fall back independently.
 */
function awaitNested<Model, Query, NodeType extends NodeBase<Model>>(
  child: Plan<Model, Query, NodeType>,
  mapping: Invocation,
) {
  mapping.pending = (mapping.pending ?? 0) + 1;

  const result = child.pending!.then(() => queryNested(child, mapping));

  const settled = () => {
    if (mapping.pending === 1) {
      delete mapping.pending;
    } else {
      mapping.pending! -= 1;
    }
  };
  result.then(settled, settled);

  return result;
}

/**
 * The nested plan played where the callback needs it serialized, with the mappings it recorded
 * folded into the invocation that started it. Every nested plan of one invocation records into
 * the same `mapping.nested`, so two that map the same key union.
 */
function queryNested<Model, Query, NodeType extends NodeBase<Model>>(
  child: Plan<Model, Query, NodeType>,
  mapping: Invocation,
) {
  const played = child.play();
  // Serialization can throw. Publish mappings only once the caller can use the query.
  const query = child.adapter.toQuery(played.root);

  for (const key of Object.keys(played.mappings)) {
    mapping.nested[key] = unionMappings(mapping.nested[key], played.mappings[key]);
  }

  return query;
}

/**
 * The relation query of a nested selection, merged before the walk beneath it whether the
 * callback answered at once or resolved after that walk had already collected its fields — see
 * `collectQuery`. A field of the document that conflicts with the query therefore loses to it
 * either way, and is never mapped to a relation the query loaded with other arguments.
 */
function mergeQuery<Model, Query, NodeType extends NodeBase<Model>>(
  child: Plan<Model, Query, NodeType>,
  query: Query | null | undefined,
) {
  if (query) {
    child.collectQuery(query);
  }
}

/**
 * The first field node selected at `path` beneath the field, seen through any wrapper on the
 * field's return type (an errors plugin result, for instance), whose own path leads to the type
 * the caller's path starts from. An empty path yields the field node itself, or the wrapper's
 * inner node.
 *
 * A node selected only under a `@defer` is returned like any other, whatever the plan's deferred
 * setting says — an adapter gating a computed value on this over-reports rather than under-;
 * `eachSelectedField` in matches.ts says why that direction is the safe one.
 */
function selectedFieldNodeFor<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  { field, node: fieldNode }: Position,
) {
  const { info } = plan;
  let names: ReadonlySet<string> | undefined;

  function getSelection(): ReadonlySet<string>;
  function getSelection(path: string[]): FieldNode | null;
  function getSelection(path?: string[]): ReadonlySet<string> | FieldNode | null {
    if (path === undefined) {
      names ??= collectSelectedFieldNames(info, getNamedType(field.type), [fieldNode]);
      return names;
    }
    const returnType = getNamedType(field.type);
    const match = firstMatch(
      info,
      returnType,
      fieldNode,
      path.map((name) => ({ name })),
      { prefix: includeOf(returnType)?.path },
    );

    return match?.field ?? null;
  }

  return getSelection;
}
