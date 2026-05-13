import type { GraphQLResolveInfo } from 'graphql';
import type { AnyContract } from '../types';
import { applySelectionToCollection, type MapperCollection } from './apply-selection';
import { type MapperPluginOptions, mapperOptionsFromPluginOpts } from './options';

export type Apply = <C>(collection: C) => C;

export interface CreateApplyOptions {
  info: GraphQLResolveInfo;
  contract: AnyContract;
  context: unknown;
  mapperOpts?: MapperPluginOptions;
  /** Concrete type for inline-fragment descent (Relay `node(id:)` etc.). */
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
    ).collection) as Apply;
}
