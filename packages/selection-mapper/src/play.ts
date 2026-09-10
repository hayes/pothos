/**
 * Playing a plan: the merges the traversal collected, folded into a node in the order it
 * collected them, behind the selection the caller seeds the play with.
 *
 * This is where a merge is accepted or rejected (M-3, M-4, S-7), and the only place a mapping is
 * recorded (L-2). The traversal decides nothing: a field that lost to another occurrence of
 * itself is still on the list, so a play whose seed makes it fit takes it. That is what makes
 * `queryFromPlan(plan, select)` the same query, and the same mappings, as `queryFromInfo` walked
 * with `select` as its `initial`.
 */
import { PothosValidationError } from '@pothos/core';
import { absorb, accepts, conflictOf } from './accumulate.js';
import { type Mappings, unionMappings } from './loader-map.js';
import type { NodeBase } from './node.js';
import type { Adapter, MergeOptions, Plan, PlayedPlan, RootMerge, WalkedType } from './types.js';

/** E-3, which carries nothing per merge. */
const AS_QUERY: MergeOptions = Object.freeze({ asQuery: true });

/**
 * A fresh node with `plan`'s merges folded into it, and the mappings of the merges it took.
 * `seed` takes the place of the plan's own `initial`: it is merged before anything the traversal
 * collected, so a relation or extra the document plans with other arguments loses (M-4) and its
 * field loads on its own (L-3).
 *
 * Synchronous, and runs no user callback: the queries are the ones the traversal already
 * collected, so a play of an async plan costs no more than a play of a synchronous one.
 */
export function play<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  seed?: Query,
): PlayedPlan<Model, Query, NodeType> {
  const { adapter } = plan;
  const accumulator = adapter.accumulator;
  const root = accumulator.create(plan.model);
  const first = seed ?? plan.initial;
  const settled = reusable(plan, seed);

  // E-1: merged before anything else, so on a conflict it wins.
  if (first) {
    accumulator.merge(root, first);
  }

  if (settled) {
    // Every merge that play took still fits, and every merge it left out still does not, so the
    // list has nothing left to decide: the node it built is taken whole.
    absorb(accumulator, root, settled.root);

    return { plan, root, mappings: settled.mappings };
  }

  const mappings: Mappings = {};

  for (const merge of plan.merges) {
    switch (merge.kind) {
      case 'type':
        accumulator.merge(root, merge.query);
        break;
      case 'query':
        accumulator.merge(root, merge.query, AS_QUERY);
        break;
      case 'variant':
        mergeVariant(adapter, root, merge.type, merge.variant, merge.query);
        break;
      case 'field': {
        // One options object for the pair: `merge` reads only the key and the alias, and
        // `accepts` the `ignoreArgs` alongside them.
        const options: MergeOptions = { ignoreArgs: true, key: merge.key, alias: merge.alias };

        // M-3, M-4, L-2: a field's selection is merged, and its mapping recorded, only while it
        // fits what is already in the node; otherwise it is left out and its resolver loads its
        // own data (L-3).
        if (accepts(accumulator, root, merge.query, options)) {
          accumulator.merge(root, merge.query, options);
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

  return { plan, root, mappings };
}

/**
 * A play of `plan` already settled that a play seeded with `seed` can take whole, or undefined.
 * A seed that conflicts with nothing the settled play holds (S-7) changes no decision it made,
 * since every rejection it made was against something the seed leaves in place. A seed standing
 * in for a plan's own `initial` is not that: the settled play merged the `initial` it replaces.
 */
function reusable<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
  seed: Query | undefined,
) {
  const { played } = plan;

  if (!played || (seed !== undefined && plan.initial !== undefined)) {
    return undefined;
  }

  return seed === undefined || !conflictOf(plan.adapter.accumulator, played.root, seed)
    ? played
    : undefined;
}

/**
 * S-7 for one variant selection. Unlike a field-level select, a type-level selection has no
 * per-field fallback, so a relation argument or an extra that conflicts with what is already in
 * the node is an error rather than a rejection.
 */
export function mergeVariant<Model, Query, NodeType extends NodeBase<Model>>(
  adapter: Adapter<Model, Query, NodeType>,
  node: NodeType,
  type: WalkedType,
  variant: WalkedType,
  selection: Query,
) {
  const accumulator = adapter.accumulator;
  const conflict = conflictOf(accumulator, node, selection);

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

  accumulator.merge(node, selection);
}
