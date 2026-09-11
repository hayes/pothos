import { PothosSchemaError } from '@pothos/core';
import type { MapperCollection } from './adapter.js';

/** @internal */
export function resolveSizeOption<Args, Ctx>(
  opt: number | ((args: Args, ctx: Ctx) => number) | undefined,
  args: Args,
  ctx: Ctx,
): number | undefined {
  if (opt === undefined) {
    return undefined;
  }
  return typeof opt === 'function' ? opt(args, ctx) : opt;
}

/** Options used by the public selection application helpers. */
export interface MapperPluginOptions {
  defaultConnectionSize?: number;
  maxConnectionSize?: number;
  skipDeferredFragments?: boolean;
  /** @internal Whether selection conflicts can be serviced by a loader. */
  fallback?: boolean;
}

/** @internal */
export interface FullPrismaNextPluginOptions<Contract = unknown> extends MapperPluginOptions {
  contract: Contract;
  collections?:
    | Record<string, MapperCollection | undefined>
    | ((context: unknown) => Record<string, MapperCollection | undefined>);
}

/** @internal */
export function readPluginOptions<Contract = unknown>(builder: {
  options: unknown;
}): FullPrismaNextPluginOptions<Contract> | undefined {
  const options = (builder.options as { prismaNext?: FullPrismaNextPluginOptions<Contract> })
    .prismaNext;
  if (options?.skipDeferredFragments && !options.collections) {
    throw new PothosSchemaError(
      'prismaNext.skipDeferredFragments requires prismaNext.collections for fallback loading.',
    );
  }
  return options;
}

/** @internal */
export function mapperOptionsFromPluginOpts(
  opts: MapperPluginOptions | undefined,
): MapperPluginOptions {
  if (!opts) {
    return {};
  }
  const out: MapperPluginOptions = {};
  if (opts.defaultConnectionSize !== undefined) {
    out.defaultConnectionSize = opts.defaultConnectionSize;
  }
  if (opts.maxConnectionSize !== undefined) {
    out.maxConnectionSize = opts.maxConnectionSize;
  }
  out.fallback = opts.fallback ?? !!(opts as FullPrismaNextPluginOptions).collections;
  out.skipDeferredFragments = opts.skipDeferredFragments ?? out.fallback;
  return out;
}
