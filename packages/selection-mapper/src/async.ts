import type { NodeBase } from './node.js';
import type { Plan } from './types.js';

export function noop() {}

/**
 * A-3, M-2: a plan that threw synchronously never reaches `finish`, so the merges it had already
 * chained would reject unobserved once their callbacks settle. The throw is what the caller sees.
 */
export function abandon<Model, Query, NodeType extends NodeBase<Model>>(
  plan: Plan<Model, Query, NodeType>,
) {
  plan.pending?.catch(noop);
}

/**
 * A-2: appends the merge of `value` to the plan's pending chain. Only merges are chained, never
 * user code, so a link can never append another and the chain needs no loop. Each link waits on
 * the previous one, so async merges run in the order they were appended (A-4). Both promises get
 * a handler at once, so a callback that rejects early is never an unhandled rejection.
 */
export function chain<Model, Query, NodeType extends NodeBase<Model>, T>(
  plan: Plan<Model, Query, NodeType>,
  value: PromiseLike<T>,
  merge: (v: T) => void,
) {
  const prev = plan.pending;

  plan.pending = prev
    ? Promise.all([prev, value]).then(([, v]) => merge(v))
    : Promise.resolve(value).then(merge);
}

/**
 * The single exit of every entry point (A-3): `done` runs now when nothing is pending, else
 * after every pending merge. The result is then a promise behind the declared synchronous type
 * (A-7): a schema without async callbacks never sees one, and one with them must await it.
 * Fixed arity, so the synchronous call allocates nothing.
 */
export function finish<Model, Query, NodeType extends NodeBase<Model>, R>(
  plan: Plan<Model, Query, NodeType>,
  done: (plan: Plan<Model, Query, NodeType>) => R,
): R;
export function finish<Model, Query, NodeType extends NodeBase<Model>, A, R>(
  plan: Plan<Model, Query, NodeType>,
  done: (plan: Plan<Model, Query, NodeType>, arg: A) => R,
  arg: A,
): R;
export function finish<Model, Query, NodeType extends NodeBase<Model>, A, R>(
  plan: Plan<Model, Query, NodeType>,
  done: (plan: Plan<Model, Query, NodeType>, arg?: A) => R,
  arg?: A,
): R {
  return plan.pending ? (plan.pending.then(() => done(plan, arg)) as R) : done(plan, arg);
}
