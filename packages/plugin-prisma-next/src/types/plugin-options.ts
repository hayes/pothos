import type { SchemaTypes } from '@pothos/core';
import type { AnyContract, BareModelName, ModelKeys } from './models.js';

// A contract typed only as `AnyContract` has no model keys to check collections against.
type PrismaNextCollections<TContract extends AnyContract> =
  string extends keyof TContract['domain']['namespaces'] ? object : TypedCollections<TContract>;

// Collections are matched by model name and by the contract on their `ctx`, not structurally.
// `CollectionBase.ctx` is marked internal in rc.22, but Prisma's public types read it too.
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
export interface PrismaNextExecutionContext<TContract extends AnyContract> {
  readonly contract: TContract;
  readonly contractCodecs: {
    forColumn(namespaceId: string, table: string, column: string): unknown;
  };
}

/** The parts of a Prisma ORM client the plugin reads. */
export interface PrismaNextClient<TContract extends AnyContract> {
  readonly orm: PrismaNextCollections<TContract>;
  readonly context: PrismaNextExecutionContext<TContract>;
}

/** A client for one request, such as a transaction, which doesn't expose `context`. */
export interface PrismaNextRequestClient<TContract extends AnyContract> {
  readonly orm: PrismaNextCollections<TContract>;
}

/**
 * Not a unit type like `never`, so `context` doesn't discriminate the options: a client object
 * passed with `context` is then reported on `context` rather than on `client`.
 */
interface ContextOnlyForClientFunction {
  readonly 'prismaNext.context is only for a client function; a client object carries its own': never;
}

export type PrismaNextPluginOptions<Types extends SchemaTypes> = {
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
      readonly client: (
        ctx: Types['Context'],
      ) => PrismaNextRequestClient<Types['PrismaNextContract']>;
      /**
       * The `context` of the client the function's clients come from, such as `db.context`. Its
       * contract is read when the schema is built, before any request provides a client.
       */
      readonly context: PrismaNextExecutionContext<Types['PrismaNextContract']>;
    }
  | {
      readonly client: PrismaNextClient<Types['PrismaNextContract']>;
      /** A client object carries its own `context`, so this is only for a client function. */
      readonly context?: ContextOnlyForClientFunction;
    }
);
