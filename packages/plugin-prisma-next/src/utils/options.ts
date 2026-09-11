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

/** @internal */
export interface MapperPluginOptions {
  defaultConnectionSize?: number;
  maxConnectionSize?: number;
  skipDeferredFragments?: boolean;
}

/** @internal */
export interface FullPrismaNextPluginOptions<Contract = unknown> extends MapperPluginOptions {
  contract: Contract;
}

/** @internal */
export function readPluginOptions<Contract = unknown>(builder: {
  options: unknown;
}): FullPrismaNextPluginOptions<Contract> | undefined {
  return (builder.options as { prismaNext?: FullPrismaNextPluginOptions<Contract> }).prismaNext;
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
  if (opts.skipDeferredFragments !== undefined) {
    out.skipDeferredFragments = opts.skipDeferredFragments;
  }
  return out;
}
