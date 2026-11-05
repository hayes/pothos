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
  isAbstractType,
  isInterfaceType,
  isObjectType,
  Kind,
  type SelectionNode,
} from 'graphql';
import type { NodeBase } from './adapter.js';
import { unexpectedError } from './errors.js';
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
import type { Plan, PlayKind } from './plan.js';
import { fieldShape, selectionShape } from './shape.js';
import type { NestedSelection, Position, SelectFn, WalkedType } from './types.js';

/**
 * One select invocation's mapping record while the invocation runs: `pending` counts the nested
 * selections it started whose plan is async and has not resolved. Removed once every one has,
 * so a recorded `Mapping` never carries it and a synchronous invocation never touches it.
 */
interface Invocation extends Mapping {
  pending?: number;
}

/** The plays an invocation's merge was collected for, as bits, so it is collected once for each. */
const IN_PLAIN = 1;
const IN_EXPANDING = 2;
const IN_BOTH = IN_PLAIN | IN_EXPANDING;

/**
 * One select function's invocation within a walk, which a later visit to a field of the same shape
 * at the same place takes instead of invoking the select function again: its query, its mapping
 * and so the plan beneath it.
 */
interface FieldInvocation<Query> {
  type: WalkedType;
  /** The mapping key without its type: the alias path from the walked field. */
  relative: string;
  /** What the field is defined by; see `definitionOf`. */
  definition: unknown;
  key: string;
  alias: string;
  query: MaybePromise<Query | false | null | undefined>;
  mapping: Invocation;
  /** The plays its merge has been collected for. */
  collected: number;
}

/**
 * The invocations of one walk by the shape of the field node (see `fieldShape`): two nodes of one
 * shape select the same thing under the same response key, so one invocation answers for both.
 * Local to a walk, so the invocations it holds go with it.
 */
type Invocations<Query> = Map<number, FieldInvocation<Query>[]>;

/**
 * What defines a field, to tell an implementation's copy of an interface field from an override.
 * Pothos builds every implementation's copy of an inherited field from the interface's own field
 * options, so those agree exactly when the field was not redefined, the way plugin-prisma-next
 * names slots and every plugin's resolver accepts an interface's mapping. A field built elsewhere
 * has no options, and only an identical select function says the same.
 *
 * `Adapter.fieldSelection` is handed the walked type and may vary a selection by it. Only a select
 * function is ever reused, and the adapters vary only a static selection by type (prisma-next's
 * empty selection for an interface field without one), so a select function is taken to depend on
 * the field's definition alone.
 */
function definitionOf(field: Position['field'], selection: unknown): unknown {
  return field.extensions?.pothosOptions ?? selection;
}

/**
 * The position of one select invocation. Its own link is exact for that invocation, and reading
 * further up is what ties a walk to the invocations above it, so `parent` tells the plan.
 */
function positionIn(
  plan: { readonly position?: Position; positionRead: boolean },
  type: WalkedType,
  field: Position['field'],
  node: FieldNode,
): Position {
  return {
    get parent() {
      plan.positionRead = true;

      return plan.position;
    },
    get walkParent() {
      return plan.position;
    },
    type,
    field,
    node,
  };
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
  onlyIn: PlayKind | undefined,
) {
  const selection = plan.adapter.typeSelection(variant);

  if (selection) {
    plan.collect({ kind: 'variant', type, variant, query: selection, onlyIn });
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
        enterVariant(plan, firstType, type, undefined);
      } else {
        firstType = type;
        enter(plan, type);
      }
    }

    const entered = new Set<string>();

    for (const selections of selectionSets) {
      enterVariants(plan, type, type, selections, entered, undefined);
    }
  }

  const invocations: Invocations<Query> = new Map();

  for (const { type, selectionSets, indirectPath } of resolved) {
    const walked = new Set<string>();

    for (const selections of selectionSets) {
      walkSelections(plan, type, selections, indirectPath, true, walked, undefined, invocations);
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
 * Whether `fragment` was already visited under `key` in the pass `visited` belongs to, recording
 * it if not. A valid fragment DAG can spread the same fragment at every level, so visiting every
 * spread is exponential in its depth. Inline fragments cannot repeat.
 */
function visitedBefore(visited: Set<string>, key: string, fragment: Fragment): boolean {
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
 *
 * `selections` are walked as `type`, and variants are entered relative to `origin`, the type the
 * plan was last entered as. They differ only under a fragment that did not move the plan, such as
 * an expansion that selects no fields of its own: it narrows the walk to the implementations it
 * covers without entering them, so a nested fragment that selects fields enters the variant
 * instead.
 */
function enterVariants<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  origin: WalkedType,
  type: WalkedType,
  selections: readonly SelectionNode[],
  visited: Set<string>,
  onlyIn: PlayKind | undefined,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      continue;
    }

    const fragment = applicableFragment(plan, selection);

    if (!fragment) {
      continue;
    }

    for (const walk of fragmentWalks(plan, type, fragment, onlyIn)) {
      if (visitedBefore(visited, `${origin.name}>${type.name}:${walk.onlyIn}`, fragment)) {
        continue;
      }

      const { types } = walk;
      // A typed fragment directly under `origin` moves the plan to its type. An expansion, an
      // untyped fragment, or one nested under a fragment that did not move the plan, moves it
      // only when it selects fields of its own.
      const enters =
        types.length > 0 &&
        ((fragment.typeCondition && !walk.walksImplementations && type === origin) ||
          selectsFields(fragment.selectionSet.selections));

      for (const as of types.length > 0 ? types : [type]) {
        if (enters && as !== origin) {
          enterVariant(plan, origin, as, walk.onlyIn);
        }

        enterVariants(
          plan,
          enters ? as : origin,
          as,
          fragment.selectionSet.selections,
          visited,
          walk.onlyIn,
        );
      }
    }
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
  onlyIn: PlayKind | undefined,
  invocations: Invocations<Query>,
) {
  for (const selection of selections) {
    if (selection.kind === Kind.FIELD) {
      if (fieldsApply) {
        walkField(plan, type, selection, indirectPath, onlyIn, invocations);
      }

      continue;
    }

    const fragment = applicableFragment(plan, selection);

    if (!fragment) {
      continue;
    }

    for (const walk of fragmentWalks(plan, type, fragment, onlyIn)) {
      if (visitedBefore(visited, `${type.name}:${fieldsApply}:${walk.onlyIn}`, fragment)) {
        continue;
      }

      const { types } = walk;

      for (const as of types.length > 0 ? types : [type]) {
        walkSelections(
          plan,
          as,
          fragment.selectionSet.selections,
          indirectPath,
          // An untyped fragment inherits; a typed one applies iff it can apply to `type`.
          fragment.typeCondition ? types.length > 0 : fieldsApply,
          visited,
          walk.onlyIn,
          invocations,
        );
      }
    }
  }
}

/** One way to walk a fragment: the types it is walked as, and the plays that take the result. */
interface FragmentWalk {
  types: WalkedType[];
  /** Whether `types` are the implementations an expansion covers. */
  walksImplementations: boolean;
  /** The only kind of play that takes what this walk collects, or undefined for both kinds. */
  onlyIn: PlayKind | undefined;
}

/**
 * The ways `fragment` is walked while walking `type`. An expansion (see `fragmentTypesOf`) is
 * walked twice. For expanding plays it is walked as the types it covers. For plain plays it is
 * walked as a fragment that cannot apply. A walk already inside one of the two keeps to it.
 *
 * `Plan.play` tries an expanding play first. If the variants an expansion enters have conflicting
 * type-level selections, or one of them displaces a field, it falls back to a plain play, so an
 * expansion never makes a document fail or a field reload.
 *
 * The plain walk comes first. No play sees the order, since each takes only its own kind's merges,
 * but the expanding walk takes the plain one's invocation of a field it reaches again (see
 * `walkField`), and a walk beneath a field is shared with the first invocation that made it (see
 * `Plan.nested`), so a position recorded beneath either holds the types the document names.
 */
function fragmentWalks<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  fragment: Fragment,
  onlyIn: PlayKind | undefined,
): FragmentWalk[] {
  const { types, isExpansion } = fragmentTypesOf(plan, type, fragment);

  if (!isExpansion || types.length === 0) {
    return [{ types, walksImplementations: false, onlyIn }];
  }

  const expanding: FragmentWalk = { types, walksImplementations: true, onlyIn: 'expanding' };
  const plain: FragmentWalk = { types: [], walksImplementations: false, onlyIn: 'plain' };

  if (onlyIn === undefined) {
    return [plain, expanding];
  }

  return [onlyIn === 'expanding' ? expanding : plain];
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
 * The types to walk `fragment` as while walking `type`, or none when the fragment cannot apply to
 * `type` (its fields are suppressed; nested fragments are still classified against `type`). An
 * untyped fragment inherits `type`. A type accepts a fragment on itself or on an interface it
 * implements, walked as itself: a plan on an object type is a plan on rows of that type, so a
 * fragment on any other object type cannot apply to them. An interface also accepts a fragment
 * on another type of the same model, walked as that type, so that type's own selection is planned
 * for the rows that resolve to it. A fragment on an abstract type of no model (`... on Node`
 * beneath a model interface), or of another model, is an expansion. It is walked as each
 * implementation of `type` it covers; see `fragmentWalks`.
 */
function fragmentTypesOf<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  fragment: Fragment,
): { types: WalkedType[]; isExpansion: boolean } {
  if (!fragment.typeCondition) {
    return { types: [type], isExpansion: false };
  }

  const { schema } = plan.info;
  const condition = schema.getType(fragment.typeCondition.name.value)!;

  if (isOfType(type, condition)) {
    return { types: [type], isExpansion: false };
  }

  if (!isInterfaceType(type)) {
    return { types: [], isExpansion: false };
  }

  const model = plan.adapter.modelFor(type);

  if (
    (isObjectType(condition) || isInterfaceType(condition)) &&
    plan.adapter.modelFor(condition) === model
  ) {
    return { types: [condition], isExpansion: false };
  }

  if (isAbstractType(condition)) {
    return {
      types: schema
        .getPossibleTypes(type)
        .filter(
          (possible) =>
            schema.isSubType(condition, possible) && plan.adapter.modelFor(possible) === model,
        ),
      isExpansion: plan.adapter.modelFor(condition) !== model,
    };
  }

  return { types: [], isExpansion: false };
}

/** Whether `type` is `condition` itself or implements it. */
function isOfType(type: WalkedType, condition: GraphQLNamedType) {
  return (
    condition === type || (isInterfaceType(condition) && type.getInterfaces().includes(condition))
  );
}

/** Whether `selections` select a field directly; `__typename` reads nothing from the row. */
function selectsFields(selections: readonly SelectionNode[]): boolean {
  return selections.some(
    (selection) => selection.kind === Kind.FIELD && !selection.name.value.startsWith('__'),
  );
}

/**
 * Collects what `fieldNode` (a field of `type`) selects. A select function is invoked once per
 * place in a walk: the plain and expanding walks of an expansion reach a field node again, and the
 * second takes the first's invocation (see `reusedInvocation`), so they share its query, mapping
 * and the plan beneath it. `invocations` holds the walk's; without it every call invokes.
 */
export function walkField<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  type: WalkedType,
  fieldNode: FieldNode,
  indirectPath: string[],
  onlyIn: PlayKind | undefined,
  invocations?: Invocations<Query>,
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
    if (onlyIn === 'expanding') {
      plan.expansionReadsRow = true;
    }

    return;
  }

  const alias = fieldNode.alias?.value ?? name;
  const relative = `${indirectPath.length > 0 ? `${indirectPath.join('.')}.` : ''}${alias}`;
  const key = `${type.name}@${relative}`;

  if (typeof selection !== 'function') {
    collectField(plan, key, alias, selection, EMPTY_MAPPING, onlyIn);

    return;
  }

  const definition = definitionOf(field, selection);
  const shape = fieldShape(info, fieldNode);
  const known = invocations?.get(shape);
  const reused =
    known && reusedInvocation(known, type, relative, definition, onlyIn === 'expanding');

  if (reused) {
    collectInvocation(plan, reused, onlyIn);

    return;
  }

  // Where this field is, linked to where the plan it was found in hangs. One link, built once per
  // select invocation; nothing walks it unless the adapter's callback asks.
  const position = positionIn(plan, type, field, fieldNode);
  // This invocation's mapping; every nested plan it makes records into `mapping.nested`, which
  // stays invisible to the plan until the invocation's query is accepted.
  const mapping: Invocation = { nested: {}, position };
  const args = getMappedArgumentValues(field, fieldNode, context, info);
  const select = selection as SelectFn<Query>;

  // The select runs as soon as its own arguments are known; only its merge waits.
  const query = isThenable(args)
    ? args.then((mapped) => runSelect(plan, select, mapped, position, mapping))
    : runSelect(plan, select, args, position, mapping);
  const invocation: FieldInvocation<Query> = {
    type,
    relative,
    definition,
    key,
    alias,
    query,
    mapping,
    collected: 0,
  };

  if (known) {
    known.push(invocation);
  } else {
    invocations?.set(shape, [invocation]);
  }

  collectInvocation(plan, invocation, onlyIn);
}

/**
 * The invocation already made in this walk that a visit to a field of the same shape as `type`, at
 * `relative`, takes instead of invoking again: one made as `type` itself, or, in an expanding
 * walk, one made as an interface of `type` that defines the field the same way.
 *
 * The first covers the plain and expanding walks reaching one field node as one type, and two
 * nodes of one shape. A node that takes another's invocation is never handed to a select
 * function: the position (`position.node`) and the selected-field lookup are the first node's,
 * which has the same alias, arguments, directives and selection set. The second covers a field the document names on the model interface (`...
 * on Node { ... on UserI { posts } }` beneath `UserI`), which the expanding walk reaches on each
 * implementation: the plain invocation already plans it for every row of the interface, with the
 * same definition, arguments and selection set, so the implementations differ only in the type
 * their positions name. They take the plain one's, whose positions name the interface, as they
 * would beneath a shared walk. Its mapping is recorded under the interface's key, and a resolver
 * on an implementation accepts a mapping recorded under an interface only for the same definition
 * of the field. An implementation that redefines the field is invoked as itself.
 */
function reusedInvocation<Query>(
  known: FieldInvocation<Query>[],
  type: WalkedType,
  relative: string,
  definition: unknown,
  expanding: boolean,
): FieldInvocation<Query> | undefined {
  let inherited: FieldInvocation<Query> | undefined;

  for (const invocation of known) {
    if (invocation.relative !== relative) {
      continue;
    }

    if (invocation.type === type) {
      return invocation;
    }

    if (
      expanding &&
      !inherited &&
      invocation.definition === definition &&
      isInterfaceType(invocation.type) &&
      type.getInterfaces().includes(invocation.type)
    ) {
      inherited = invocation;
    }
  }

  return inherited;
}

/**
 * Collects `invocation`'s merge for the plays of kind `onlyIn` that do not take it yet. A play
 * takes one merge per invocation: a second copy of the same query and mapping would change
 * nothing it decides.
 */
function collectInvocation<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  invocation: FieldInvocation<Query>,
  onlyIn: PlayKind | undefined,
) {
  const wanted = onlyIn === 'plain' ? IN_PLAIN : onlyIn === 'expanding' ? IN_EXPANDING : IN_BOTH;
  const missing = wanted & ~invocation.collected;

  if (missing === 0) {
    return;
  }

  invocation.collected |= missing;

  const kind: PlayKind | undefined =
    missing === IN_BOTH ? undefined : missing === IN_PLAIN ? 'plain' : 'expanding';
  const { key, alias, query, mapping } = invocation;

  if (isThenable(query)) {
    plan.chain(query as PromiseLike<Query | false | null | undefined>, (resolved) =>
      collectField(plan, key, alias, resolved, mapping, kind),
    );
  } else {
    collectField(plan, key, alias, query, mapping, kind);
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
  onlyIn: PlayKind | undefined,
) {
  if (!query) {
    return;
  }

  if (mapping.pending) {
    // Only a select invocation can be pending, and every one of those has a position.
    throw unexpectedError(
      `The selection function of ${fieldName(mapping.position!)} returned while a nested selection it started was still pending. Await nestedSelection() (or a helper built on it, such as getQuery) inside an async selection function.`,
    );
  }

  plan.collect({ kind: 'field', key, alias, query, mapping, onlyIn });
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
    // A caller may already have started this promise before path/type validation runs.
    let query: MaybePromise<Query | null | undefined> =
      typeof rawQuery === 'function' || rawQuery === true ? undefined : rawQuery;

    try {
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
      query =
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

      const paths = include?.paths?.length
        ? include.paths
        : include?.path?.length
          ? [include.path]
          : undefined;
      // Everything a walk beneath this field node reads: the shape of its selection set, not the
      // node, so a fragment spread beneath many fields is walked once. The paths are data: an
      // include's segments are names and type names.
      const walkKey = `${selectionShape(info, fieldNode.selectionSet)}:${returnType.name}:${target.name}:${paths ? JSON.stringify(paths) : ''}`;

      const child = plan.nested(target, position, walkKey, (walked) => {
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
            walked,
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

          walkBranches(walked, [
            ...(target === returnType ? [] : [asType(target)]),
            asType(returnType),
          ]);
        }
      });

      if (isThenable(query)) {
        child.chain(query as PromiseLike<Query | null | undefined>, (resolved) =>
          mergeQuery(child, resolved),
        );
      } else {
        mergeQuery(child, query);
      }

      // A promise behind the declared synchronous type, as `finish` returns one.
      return child.pending ? (awaitNested(child, mapping) as Query) : queryNested(child, mapping);
    } catch (error) {
      if (isThenable(query)) {
        query.then(
          () => {},
          () => {},
        );
      }
      throw error;
    }
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
