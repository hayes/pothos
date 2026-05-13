export type RefineCallback = (rel: unknown, args: unknown, ctx: unknown) => unknown;

export interface IncludeFieldOp {
  kind: 'include';
  relationName: string;
  parentModel: string;
  isToMany: boolean;
  refine?: RefineCallback;
}

export interface PaginatedIncludeFieldOp {
  kind: 'paginatedInclude';
  relationName: string;
  parentModel: string;
  cursor: string | readonly string[];
  paths: readonly { name: string; type?: string }[][];
  totalCountAlias?: string;
  defaultSize?: number | ((args: unknown, ctx: unknown) => number);
  maxSize?: number | ((args: unknown, ctx: unknown) => number);
  refine?: RefineCallback;
}

export interface CountFieldOp {
  kind: 'count';
  relationName: string;
  parentModel: string;
  where?: unknown | ((accessor: unknown, args: unknown, ctx: unknown) => unknown);
}

export interface AggregateFieldOp {
  kind: 'aggregate';
  relationName: string;
  parentModel: string;
  aggregate: (rel: unknown, args: unknown, ctx: unknown) => unknown;
  where?: unknown | ((accessor: unknown, args: unknown, ctx: unknown) => unknown);
}

export interface SameRowFieldOp {
  kind: 'sameRow';
  typeName: string;
  select?: readonly string[];
}

export type PrismaNextFieldOp =
  | IncludeFieldOp
  | PaginatedIncludeFieldOp
  | CountFieldOp
  | AggregateFieldOp
  | SameRowFieldOp;

/**
 * `typeName` and `modelName` diverge for variant prismaObjects:
 * `prismaObject('User', { variant: 'AdminUser' })` registers a GraphQL
 * type named `AdminUser` backed by contract model `User`. `typeName` is
 * the public-facing identity that plugin-relay's `getTypeBrand` returns.
 */
export interface PreparedFieldExtension {
  readonly modelName: string;
  readonly typeName: string;
}
