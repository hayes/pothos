import type { MaybePromise } from '@pothos/core';
import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from '../types.js';
import type { MapperCollection } from './adapter.js';
import { applySelectionToCollection } from './map-query.js';
import { type MapperPluginOptions, mapperOptionsFromPluginOpts } from './options.js';

/** Returns a promise only when a `select` callback beneath the field is async. */
export type Apply = <C>(collection: C) => MaybePromise<C>;

export interface CreateApplyOptions {
  info: GraphQLResolveInfo;
  contract: AnyContract;
  context: unknown;
  mapperOpts?: MapperPluginOptions;
  /** Walk as this type rather than the return type (a `node(id:)` load). */
  typeName?: string;
  /** Indirect-include path prefix, e.g. `[['edges', 'node'], ['nodes']]`. */
  paths?: string[][];
  extraColumns?: readonly string[];
}

export function createApply(opts: CreateApplyOptions): Apply {
  const mapperOpts = mapperOptionsFromPluginOpts(opts.mapperOpts);
  const applyOpts = {
    ...mapperOpts,
    ...(opts.typeName !== undefined ? { typeName: opts.typeName } : {}),
    ...(opts.paths !== undefined ? { paths: opts.paths } : {}),
    ...(opts.extraColumns !== undefined ? { extraColumns: opts.extraColumns } : {}),
  };
  return ((collection: unknown) =>
    applySelectionToCollection(
      collection as MapperCollection,
      opts.info,
      opts.contract,
      opts.context,
      applyOpts,
    )) as Apply;
}
