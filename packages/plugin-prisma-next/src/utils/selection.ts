export type RefineCallback = (rel: unknown, args: unknown, ctx: unknown) => unknown;

export type CountWhere = unknown | ((accessor: unknown, args: unknown, ctx: unknown) => unknown);

export interface PaginationSpec {
  cursor: string | readonly string[];
  defaultSize?: number | ((args: unknown, ctx: unknown) => number);
  maxSize?: number | ((args: unknown, ctx: unknown) => number);
}

export interface BranchSelection {
  args: Record<string, unknown>;
  refine?: RefineCallback;
  pagination?: PaginationSpec;
  parentFkColumns: readonly string[];
  inner: PrismaNextSelection;
}

export interface CountSelection {
  args: Record<string, unknown>;
  where?: CountWhere;
  refine?: RefineCallback;
}

export interface AggregateBranchSelection {
  args: Record<string, unknown>;
  aggregate: (rel: unknown, args: unknown, ctx: unknown) => unknown;
  where?: unknown | ((accessor: unknown, args: unknown, ctx: unknown) => unknown);
}

// All branches/counts on one relation share `isToMany`, which decides
// whether the renderer can emit a combine spec or must emit a plain
// include.
export interface RelationSelection {
  isToMany: boolean;
  branches: Map<string, BranchSelection>;
  counts: Map<string, CountSelection>;
  aggregates: Map<string, AggregateBranchSelection>;
}

export interface PrismaNextSelection {
  columns: Set<string>;
  relations: Map<string, RelationSelection>;
}

export function emptySelection(): PrismaNextSelection {
  return { columns: new Set(), relations: new Map() };
}

export function getOrCreateRelation(
  selection: PrismaNextSelection,
  relationName: string,
  isToMany: boolean,
): RelationSelection {
  let rel = selection.relations.get(relationName);
  if (!rel) {
    rel = { isToMany, branches: new Map(), counts: new Map(), aggregates: new Map() };
    selection.relations.set(relationName, rel);
  }
  return rel;
}
