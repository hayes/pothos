/**
 * What the ORM plugins use: the entry points, the `Adapter` classes their own adapters extend,
 * and the loader-map, usage and equality helpers their adapters and loaders call. Everything
 * else is module-private; see the README.
 */
export { Adapter, type NodeBase } from './adapter.js';
export { deepEqual } from './deep-equal.js';
export { planFromInfo, queryFromInfo, queryFromPlan, rowPlanFromInfo } from './entry.js';
export {
  cacheKey,
  getLoaderMapping,
  type Mapping,
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
export type { Plan, PlayedPlan } from './plan.js';
export { type EntryVisitor, hasKeys, type Node, TreeAdapter } from './tree.js';
export type {
  EntryOptions,
  MergeOptions,
  NestedSelection,
  Position,
  SelectFn,
  TypeLevelConflict,
  WalkedType,
} from './types.js';
