/**
 * What the ORM plugins use: the `Plan` class with the two entry points on it, the `Adapter`
 * classes their own adapters extend, and the loader-map, usage and equality helpers their
 * adapters and loaders call. Everything else is module-private; see the README.
 */
export { Adapter } from './adapter.js';
export { deepEqual } from './deep-equal.js';
export {
  cacheKey,
  getLoaderMapping,
  type Mappings,
  setFieldMapping,
  setLoaderMappings,
  setRowMappings,
} from './loader-map.js';
export {
  type IndirectInclude,
  type IndirectPathSegment,
  type PathSegment,
  selectedFieldNames,
} from './matches.js';
export { type Node, NodeAdapter, type QueryVisitor } from './node.js';
export { Plan, type PlayedPlan } from './plan.js';
export type {
  MergeOptions,
  NestedSelection,
  Position,
  SelectFn,
  WalkedType,
} from './types.js';
