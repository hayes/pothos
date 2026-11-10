import type { SchemaTypes } from '@pothos/core';
import type { AnyContract, BareModelName, ModelKeys } from './models.js';

// A contract typed only as `AnyContract` has no model keys to check collections against.
type PrismaCollections<TContract extends AnyContract> =
  string extends keyof TContract['domain']['namespaces'] ? object : TypedCollections<TContract>;

// Collections are matched by model name and by the contract on their `ctx`, not structurally.
// `CollectionBase.ctx` is marked internal in rc.23, but Prisma's public types read it too.
// Comparing each `Collection` against one built from `TContract` costs more than the rest of the
// builder setup, while comparing the contract to itself is an identity check.
interface CollectionOfModel<TContract extends AnyContract, M extends string> {
  readonly modelName: M;
  readonly ctx: { readonly context: { readonly contract: TContract } };
}

type TypedCollections<TContract extends AnyContract> = {
  [M in ModelKeys<TContract>]?: CollectionOfModel<TContract, BareModelName<M>>;
} & {
  [Ns in keyof TContract['domain']['namespaces'] & string]?: {
    [M in keyof TContract['domain']['namespaces'][Ns]['models'] & string]?: CollectionOfModel<
      TContract,
      M
    >;
  };
};

/** The parts of a client's `context` the plugin reads, which are the contract and its codecs. */
export interface PrismaExecutionContext<TContract extends AnyContract> {
  readonly contract: TContract;
  readonly contractCodecs: {
    forColumn(namespaceId: string, table: string, column: string): unknown;
  };
  readonly codecDescriptors: {
    descriptorFor(codecId: string): { readonly traits: readonly string[] } | undefined;
  };
}

/** The parts of a Prisma ORM client the plugin reads. */
export interface PrismaClient<TContract extends AnyContract> {
  readonly orm: PrismaCollections<TContract>;
  readonly context: PrismaExecutionContext<TContract>;
}

/** A client for one request, such as a transaction, which doesn't expose `context`. */
export interface PrismaRequestClient<TContract extends AnyContract> {
  readonly orm: PrismaCollections<TContract>;
}

// TypeScript reports options matching neither client form against the last form with as many of
// their keys, so the function form goes last: a client function without `context` is told
// `context` is missing.
export type PrismaPluginOptions<Types extends SchemaTypes> = {
  /** Whether to leave deferred fragments out of the initial load. Defaults to true. */
  readonly skipDeferredFragments?: boolean;
  readonly defaultConnectionSize?: number;
  readonly maxConnectionSize?: number;
  /**
   * Whether a `relatedConnection`'s `totalCount` applies its `query.where`, so it counts the rows
   * the connection pages. Set to false to count every related row. Defaults to true.
   */
  readonly filterConnectionTotalCount?: boolean;
} & (
  | {
      readonly client: PrismaClient<Types['PrismaContract']>;
      /** Only used when `client` is a function. A client object already has its `context`. */
      readonly context?: never;
    }
  | {
      readonly client: (ctx: Types['Context']) => PrismaRequestClient<Types['PrismaContract']>;
      /**
       * The client's `context`, such as `db.context`. The plugin reads the contract from it when
       * the schema is built, before any request provides a client.
       */
      readonly context: PrismaExecutionContext<Types['PrismaContract']>;
    }
);
