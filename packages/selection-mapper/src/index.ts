/**
 * What the ORM plugins use: the entry points, the `Adapter` contract with the types it mentions,
 * and the loader-map, node, usage, and equality helpers their adapters and loaders call.
 * Everything else is module-private; see the README.
 */
export { deepEqual } from './deep-equal.js';
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
export { createNode, type Node, relation } from './node.js';
export { extendWithUsage, isUsed } from './usage.js';
export {
  type Adapter,
  defaultFragmentType,
  type EntryOptions,
  type Env,
  type NestedSelection,
  queryFromInfo,
  type SelectFn,
  selectionStateFromInfo,
  type TypeLevelConflict,
  type Walk,
  walkFromInfo,
} from './walk.js';
