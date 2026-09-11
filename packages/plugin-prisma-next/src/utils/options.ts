import { PothosSchemaError } from '@pothos/core';

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
}

/** @internal */
export interface FullPrismaNextPluginOptions<Contract = unknown> extends MapperPluginOptions {
  contract: Contract;
}

/** @internal */
export function readPluginOptions<Contract = unknown>(builder: {
  options: unknown;
}): FullPrismaNextPluginOptions<Contract> | undefined {
  const options = (builder.options as { prismaNext?: FullPrismaNextPluginOptions<Contract> })
    .prismaNext;
  if ((options as { skipDeferredFragments?: boolean } | undefined)?.skipDeferredFragments) {
    throw new PothosSchemaError(
      'prismaNext.skipDeferredFragments is not supported: deferred selections must be loaded with the initial query.',
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
  if ((opts as { skipDeferredFragments?: boolean }).skipDeferredFragments) {
    throw new PothosSchemaError(
      'skipDeferredFragments is not supported: deferred selections must be loaded with the initial query.',
    );
  }
  return out;
}
