/**
 * What the ORM plugins use: the entry points, the `Adapter` contract with the types it mentions,
 * and the loader-map, node, usage, and equality helpers their adapters and loaders call.
 * Everything else is module-private; see the README.
 */
export { deepEqual } from './deep-equal.js';
export { planFromInfo, queryFromInfo, queryFromPlan, rowPlanFromInfo } from './entry.js';
export {
  cacheKey,
  getLoaderMapping,
  type Mapping,
  type Mappings,
  setFieldMapping,
  setLoaderMappings,
} from './loader-map.js';
export {
  type IndirectInclude,
  type IndirectPathSegment,
  type PathSegment,
  selectedFieldNames,
} from './matches.js';
export { createNode, type Node, type NodeBase, relation } from './node.js';
export type {
  Adapter,
  EntryOptions,
  NestedSelection,
  Plan,
  Position,
  RootMerge,
  SelectFn,
  TypeLevelConflict,
  WalkedType,
} from './types.js';
