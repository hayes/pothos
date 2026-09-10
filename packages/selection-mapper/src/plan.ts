/**
 * One root being planned: the two entry points that build one from a resolver's `info`, the
 * merges a traversal collected for it, and the fold that turns those merges into a node.
 *
 * A plan holds no node — playing it builds one — so the same plan can be played more than once,
 * behind a different seed each time. Playing is where a merge is accepted or rejected and the
 * only place a mapping is recorded; the traversal decides nothing, so a field that lost to
 * another occurrence of itself is still on the list and a play whose seed makes it fit takes it.
 */
import { PothosValidationError } from '@pothos/core';
import { type GraphQLNamedType, type GraphQLResolveInfo, getNamedType } from 'graphql';
import type { Adapter, NodeBase } from './adapter.js';
import { type Mapping, type Mappings, setLoaderMappings, unionMappings } from './loader-map.js';
import {
  findMatches,
  type IndirectPathSegment,
  includeOf,
  matchesForModel,
  modelOf,
  type PathSegment,
  resolveType,
} from './matches.js';
import type { Node } from './node.js';
import type { EntryOptions, MergeOptions, Position, WalkedType } from './types.js';
import { type Branch, walkBranches, walkField } from './walk.js';

// Shared, since neither carries anything per merge.
const AS_QUERY: MergeOptions = Object.freeze({ asQuery: true });
const LENIENT: MergeOptions = Object.freeze({ lenient: true });

/**
 * One merge a traversal collected, in the order it happened: a type's selection, a same-model
 * variant's, a nested selection's relation query, or a field's. A play folds the list into a
 * node; nothing is merged, accepted or rejected before then.
 *
 * A record holds its query by reference, so a select function that mutates the query it returned
 * after returning it changes what a later play builds — a bug in the select function. Nothing
 * copies it: a query is opaque to this package, which could only copy one by round-tripping it
 * through the adapter on every field.
 */
export type RootMerge<Query> =
  | { kind: 'type'; query: Query }
  | { kind: 'query'; query: Query }
  | { kind: 'variant'; type: WalkedType; variant: WalkedType; query: Query }
  | { kind: 'field'; key: string; alias: string; query: Query; mapping: Mapping };

/**
 * A plan played: the node its merges built and the mappings the accepted merges recorded. A play
 * owns its node, so a caller may merge into one without disturbing the plan or another play.
 */
export interface PlayedPlan<Model, Query, NodeType extends NodeBase<Model> = Node<Model>> {
  plan: Plan<Model, Query, NodeType>;
  root: NodeType;
  mappings: Mappings;
}

/**
 * What a plan takes from whatever created it: an entry point's options, or the plan it hangs
 * beneath. A parent plan satisfies this, so a nested plan is created from its parent directly
 * with nothing allocated to carry the values across.
 */
export interface PlanSource {
  context: object;
  info: GraphQLResolveInfo;
  /** Whether a fragment under `@defer` is walked; defaults to the adapter's own setting. */
  skipDeferredFragments?: boolean;
}

export class Plan<Model, Query, NodeType extends NodeBase<Model> = Node<Model>> {
  readonly context: object;
  readonly info: GraphQLResolveInfo;
  readonly skipDeferredFragments: boolean;
  /** What the plan loads. A node is created for it once per play. */
  readonly model: Model;

  /**
   * The merges waiting on a user callback that returned a promise, in the order they were
   * appended. Absent until the first one: a synchronous plan never creates a promise.
   */
  pending?: Promise<void>;

  /** The traversal's whole output: every merge it collected, in the order it collected them. */
  private readonly merges: RootMerge<Query>[] = [];

  /**
   * The play `settle` ran, which a later play takes whole when the seed conflicts with none of
   * it. Never handed out: a play that reuses it copies it into a node of its own.
   */
  private played?: PlayedPlan<Model, Query, NodeType>;

  /**
   * The plan for the field `info` resolves, settled, or undefined when paths are given and
   * nothing is selected under them. Declared synchronous: the result is a promise only when a
   * select function returned one, and must then be awaited. The plan is handed out rather than
   * played, so a plugin that owes a resolver a synchronous query builder settles this first and
   * plays it behind the resolver's own selection with `plan.query(select)`.
   */
  static fromInfo<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
    adapter: Adapter<Model, Query, NodeType>,
    options: EntryOptions<Query>,
  ): Plan<Model, Query, NodeType> | undefined {
    const { info, typeName, path, paths } = options;
    const returnType = getNamedType(info.returnType);
    const target = typeName ? info.schema.getType(typeName)! : returnType;

    // graphql merges every occurrence of the field's response key into `info.fieldNodes`; each is
    // planned into the one root, so the query answers whichever occurrence a resolver runs for.
    let rootType = target;
    let branches: Branch[];

    if (paths?.length || path?.length) {
      const includePaths = normalizePaths(paths?.length ? paths : [path!]);
      const prefix = includeOf(returnType)?.path;
      const found = info.fieldNodes.flatMap((fieldNode) =>
        findMatches(info, returnType, fieldNode, includePaths, { prefix }),
      );

      if (found.length === 0) {
        return undefined;
      }

      // Matches are filtered against the model the root loads, which is the first match's own
      // when no `typeName` names it: the return type is then a wrapper with no model, and
      // filtering by it would keep every match whatever model it returns.
      rootType = typeName ? target : found[0].type;

      const matches = matchesForModel(adapter, info.schema, found, rootType);
      // Every match is planned into the one root, entered under its own type first.
      branches = matches.map((match) => ({
        // A matched type with its own model (including variants of the target model) is walked
        // with its own model. Types without a model (interfaces, wrappers) are walked as the
        // requested type so its fields can be found.
        type: typeName && !modelOf(adapter, info.schema, match.type) ? target : match.type,
        fieldNodes: [match.field],
        indirectPath: match.path,
        deferred: match.deferred,
      }));
    } else {
      branches = [{ type: target, fieldNodes: info.fieldNodes, indirectPath: [], deferred: false }];
    }

    const plan = new Plan(
      adapter,
      options,
      rootType,
      positionForResolvedField(info),
      options.initial,
    );

    try {
      walkBranches(plan, branches);
    } catch (error) {
      plan.abandon();
      throw error;
    }

    return plan.finish(plan.settle);
  }

  /**
   * The plan loading the field `info` resolves for its parent row, played. The loaded row
   * replaces the parent the field resolver sees, so besides the field's own selection it
   * carries the parent type's type-level selection. The field is what the row is loaded for, so
   * it is merged first and a type-level relation whose arguments conflict with it is left out.
   */
  static forParentRow<Model, Query, NodeType extends NodeBase<Model> = Node<Model>>(
    adapter: Adapter<Model, Query, NodeType>,
    context: object,
    info: GraphQLResolveInfo,
    skipDeferredFragments?: boolean,
  ): PlayedPlan<Model, Query, NodeType> {
    const type = info.parentType;
    const plan = new Plan(adapter, { context, info, skipDeferredFragments }, type);

    try {
      // Every node selecting the field (one per fragment it appears under) plans into the same
      // row, so the loaded row satisfies each of them.
      for (const fieldNode of info.fieldNodes) {
        walkField(plan, type, fieldNode, []);
      }
    } catch (error) {
      plan.abandon();
      throw error;
    }

    return plan.finish(plan.enterParentType, type);
  }

  /**
   * `source` is an entry point's options for a root plan and the parent plan for a nested one,
   * which is why `initial` is passed beside it: it belongs to the root alone and a nested plan
   * must never inherit one. `position` is where the field this plan hangs beneath is, undefined
   * when there is no field above the plan.
   */
  constructor(
    readonly adapter: Adapter<Model, Query, NodeType>,
    source: PlanSource,
    type: GraphQLNamedType,
    readonly position?: Position,
    /** Merged first by a play a caller gives no seed of its own. */
    readonly initial?: Query,
  ) {
    this.context = source.context;
    this.info = source.info;
    this.skipDeferredFragments = source.skipDeferredFragments ?? adapter.skipDeferredFragments;

    const model = modelOf(adapter, source.info.schema, type);

    if (!model) {
      throw new PothosValidationError(
        `Expected ${resolveType(source.info.schema, type).name} to have a model`,
      );
    }

    // Not entered: a type is entered when its selection set is walked.
    this.model = model;
  }

  /**
   * The plan beneath one nested selection: this plan's adapter, context, info and deferred
   * setting, with merges of its own. It hangs beneath the field whose select function made it.
   */
  nested(type: GraphQLNamedType, position: Position): Plan<Model, Query, NodeType> {
    return new Plan(this.adapter, this, type, position);
  }

  /** Appends one merge to the list a play folds. The traversal's only way to add to a plan. */
  collect(merge: RootMerge<Query>) {
    this.merges.push(merge);
  }

  /**
   * The relation query of the nested selection this plan was made for. It takes the head of the
   * list, so it is merged before the fields walked beneath it whether the callback that produced
   * it answered at once or resolved after the walk. A nested plan has at most one.
   */
  collectQuery(query: Query) {
    this.merges.unshift({ kind: 'query', query });
  }

  /**
   * Appends the merge of `value` to the plan's pending chain. Only merges are chained, never user
   * code, so a link can never append another and the chain needs no loop. Each link waits on the
   * previous one, so async merges run in the order they were appended. Both promises get a
   * handler at once, so a callback that rejects early is never an unhandled rejection.
   */
  chain<T>(value: PromiseLike<T>, merge: (v: T) => void) {
    const prev = this.pending;

    this.pending = prev
      ? Promise.all([prev, value]).then(([, v]) => merge(v))
      : Promise.resolve(value).then(merge);
  }

  /**
   * A plan that threw synchronously never reaches `finish`, so the merges it had already chained
   * would reject unobserved once their callbacks settle. The throw is what the caller sees.
   */
  abandon() {
    this.pending?.catch(noop);
  }

  /**
   * The single exit of every entry point: `done`, a method of this plan, runs now when nothing is
   * pending, else after every pending merge, in which case the result is a promise behind the
   * declared synchronous type. Fixed arity, so the synchronous call allocates nothing.
   */
  finish<R>(done: (this: this) => R): R;
  finish<A, R>(done: (this: this, arg: A) => R, arg: A): R;
  finish<A, R>(done: (this: this, arg?: A) => R, arg?: A): R {
    return this.pending
      ? (this.pending.then(() => done.call(this, arg)) as R)
      : done.call(this, arg);
  }

  /**
   * A fresh node with this plan's merges folded into it, and the mappings of the merges it took.
   * `seed` takes the place of the plan's own `initial`: it is merged before anything the traversal
   * collected, so a relation or computed value the document plans with other arguments loses, and
   * its field falls back to loading on its own.
   *
   * Synchronous, and runs no user callback, so a play of an async plan costs no more than a play
   * of a synchronous one.
   */
  play(seed?: Query): PlayedPlan<Model, Query, NodeType> {
    const { adapter } = this;
    const root = adapter.createNode(this.model);
    const settled = this.reusable(seed);
    // Merged before anything else, so on a conflict it wins. A settled play already holds the
    // plan's own `initial`, so reusing one merges the seed and nothing else: `mergeQuery` is not
    // required to be idempotent.
    const first = settled ? seed : (seed ?? this.initial);

    if (first) {
      adapter.mergeQuery(root, first);
    }

    if (settled) {
      // Every merge that play took still fits and every merge it left out still does not, so
      // the node it built is taken whole.
      adapter.mergeNode(root, settled.root);

      return { plan: this, root, mappings: settled.mappings };
    }

    const mappings: Mappings = {};

    for (const merge of this.merges) {
      switch (merge.kind) {
        case 'type':
          adapter.mergeQuery(root, merge.query);
          break;
        case 'query':
          adapter.mergeQuery(root, merge.query, AS_QUERY);
          break;
        case 'variant':
          this.mergeVariant(root, merge.type, merge.variant, merge.query);
          break;
        case 'field': {
          // One options object for the pair: `mergeQuery` reads only the alias, and
          // `canMergeQuery` only the `ignoreArgs` beside it.
          const options: MergeOptions = { ignoreArgs: true, alias: merge.alias };

          // A field's selection is merged, and its mapping recorded, only while it fits what is
          // already in the node; otherwise it is left out and its resolver loads its own data.
          if (adapter.canMergeQuery(root, merge.query, options)) {
            adapter.mergeQuery(root, merge.query, options);
            mappings[merge.key] = unionMappings(mappings[merge.key], merge.mapping);
          }

          break;
        }
        default: {
          const unknown: never = merge;

          throw new PothosValidationError(
            `Unknown root merge ${String((unknown as RootMerge<Query>).kind)}`,
          );
        }
      }
    }

    return { plan: this, root, mappings };
  }

  /**
   * The plan played behind `seed`, its mappings recorded for the resolvers beneath it, and its
   * node serialized. Every play records its mappings on the request context; an adapter whose
   * resolvers read a loaded row another way simply never looks them up.
   */
  query(seed?: Query): Query {
    // With no seed, a settled play's node is what a fresh play would build, so hand it straight
    // over: `toQuery` does not mutate, and a later seeded play still merges from it.
    const { root, mappings } = seed === undefined && this.played ? this.played : this.play(seed);

    setLoaderMappings(this.context, this.info, mappings);

    return this.adapter.toQuery(root);
  }

  /**
   * The plan played once, so a play-time error — a conflict between two type-level selections —
   * is raised now rather than only inside a `query()` a resolver may never call. That play is
   * kept, and a later one whose seed conflicts with none of it takes it whole, so settling costs
   * the resolver's own play nothing.
   */
  settle(): this {
    this.played = this.play();

    return this;
  }

  /**
   * The plan played, with `type`'s type-level selection merged in behind it, minus what conflicts
   * with the field the row is loaded for. A parent-row plan is never replayed behind a caller's
   * selection, so it plays once, here.
   */
  enterParentType(type: GraphQLNamedType): PlayedPlan<Model, Query, NodeType> {
    const played = this.play();
    const selection = this.adapter.typeSelection(type);

    if (selection) {
      this.adapter.mergeQuery(played.root, selection, LENIENT);
    }

    return played;
  }

  /**
   * A settled play that a play seeded with `seed` can take whole, or undefined. A seed conflicting
   * with nothing the settled play holds changes no decision it made, since every rejection was
   * against something the seed leaves in place — unless the seed stands in for the plan's own
   * `initial`, which the settled play already merged.
   */
  private reusable(seed: Query | undefined) {
    if (!this.played || (seed !== undefined && this.initial !== undefined)) {
      return undefined;
    }

    return seed === undefined || !this.adapter.firstConflict(this.played.root, seed)
      ? this.played
      : undefined;
  }

  /**
   * Unlike a field-level select, a type-level selection has no per-field fallback, so a relation
   * argument or a computed value that conflicts with what is already in the node is an error
   * rather than a rejection.
   */
  private mergeVariant(node: NodeType, type: WalkedType, variant: WalkedType, selection: Query) {
    const conflict = this.adapter.firstConflict(node, selection);

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

    this.adapter.mergeQuery(node, selection);
  }
}

/**
 * Where the field being resolved is, which every position beneath it links back to, so a select
 * function can tell where in the query its field sits. Undefined when `info` does not name the
 * field it resolves (a caller building one by hand): the plan then starts at its own fields.
 */
function positionForResolvedField(info: GraphQLResolveInfo): Position | undefined {
  const node = info.fieldNodes[0];
  const field = info.parentType?.getFields()[node.name.value];

  return field && { parent: undefined, type: info.parentType, field, node };
}

function normalizePaths(paths: PathSegment[][]): IndirectPathSegment[][] {
  return paths.map((path) =>
    path.map((segment) => (typeof segment === 'string' ? { name: segment } : segment)),
  );
}

function noop() {}
