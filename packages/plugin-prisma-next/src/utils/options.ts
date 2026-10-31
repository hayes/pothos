import { PothosSchemaError } from '@pothos/core';
import type { MapperCollection } from './adapter.js';
import type { PrismaNextCodecContext } from './model.js';

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

export interface MapperPluginOptions {
  defaultConnectionSize?: number;
  maxConnectionSize?: number;
  skipDeferredFragments?: boolean;
  /** @internal Whether conflicting selections can be loaded separately. */
  fallback?: boolean;
}

/** @internal */
export interface FullPrismaNextPluginOptions<Contract = unknown> extends MapperPluginOptions {
  contract: Contract;
  context?: PrismaNextCodecContext;
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
  const family = (options?.contract as { targetFamily?: unknown } | undefined)?.targetFamily;
  if (family !== undefined && family !== 'sql') {
    throw new PothosSchemaError(
      `prismaNext.contract targets the '${String(family)}' family, but @pothos/plugin-prisma-next only supports SQL contracts. ` +
        'Selection planning needs refined and combined relation includes, which that family does not provide.',
    );
  }
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
