import type { NodeBase } from './node.js';
import type { Walk } from './types.js';

export function noop() {}

/**
 * A-3, M-2: a walk that threw synchronously never reaches `finish`, so the merges it had already
 * chained would reject unobserved once their callbacks settle. The throw is what the caller sees.
 */
export function abandon<M, Map, X, N extends NodeBase<M>>(walk: Walk<M, Map, X, N>) {
  walk.pending?.catch(noop);
}

/**
 * A-2: appends the merge of `value` to the walk's pending chain. Only merges are chained, never
 * user code, so a link can never append another and the chain needs no loop. Each link waits on
 * the previous one, so async merges run in the order they were appended (A-4). Both promises get
 * a handler at once, so a callback that rejects early is never an unhandled rejection.
 */
export function chain<M, Map, X, N extends NodeBase<M>, T>(
  walk: Walk<M, Map, X, N>,
  value: PromiseLike<T>,
  merge: (v: T) => void,
) {
  const prev = walk.pending;

  walk.pending = prev
    ? Promise.all([prev, value]).then(([, v]) => merge(v))
    : Promise.resolve(value).then(merge);
}

/**
 * The single exit of every entry point (A-3): `done` runs now when nothing is pending, else
 * after every pending merge. The result is then a promise behind the declared synchronous type
 * (A-7): a schema without async callbacks never sees one, and one with them must await it.
 * Fixed arity, so the synchronous call allocates nothing.
 */
export function finish<M, Map, X, N extends NodeBase<M>, R>(
  walk: Walk<M, Map, X, N>,
  done: (walk: Walk<M, Map, X, N>) => R,
): R;
export function finish<M, Map, X, N extends NodeBase<M>, A, R>(
  walk: Walk<M, Map, X, N>,
  done: (walk: Walk<M, Map, X, N>, arg: A) => R,
  arg: A,
): R;
export function finish<M, Map, X, N extends NodeBase<M>, A, R>(
  walk: Walk<M, Map, X, N>,
  done: (walk: Walk<M, Map, X, N>, arg?: A) => R,
  arg?: A,
): R {
  return walk.pending ? (walk.pending.then(() => done(walk, arg)) as R) : done(walk, arg);
}
