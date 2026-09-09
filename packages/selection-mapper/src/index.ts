export { deepEqual } from './deep-equal.js';
export {
  cacheKey,
  getLoaderMapping,
  type Mapping,
  type Mappings,
  responsePath,
  setFieldMapping,
  setLoaderMappings,
} from './loader-map.js';
export {
  findMatches,
  type IndirectInclude,
  type IndirectPathSegment,
  includeOf,
  isDeferred,
  isSkipped,
  type Match,
  type MatchOptions,
  normalizeInclude,
  type PathSegment,
  resolveType,
  selectsPath,
} from './matches.js';
export { createNode, type Node, relation } from './node.js';
export { extendWithUsage, isUsed, usageSymbol, wrapWithUsageCheck } from './usage.js';
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
