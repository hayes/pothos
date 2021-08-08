import { createContextCache, SchemaTypes } from '@giraphql/core';
import { getFindUniqueForRef, getRefFromDelegate } from './refs.js';
import { PrismaDelegate } from './types.js';

const loaderCache = new WeakMap<object, (model: object) => ModelLoader>();

export class ModelLoader {
  model: object;
  delegate: PrismaDelegate;
  findUnique: (args: unknown, ctx: {}) => unknown;

  staged = new Set<{
    promise: Promise<Record<string, unknown>>;
    include: Record<string, unknown>;
  }>();

  constructor(
    model: object,
    delegate: PrismaDelegate,
    findUnique: (args: unknown, ctx: {}) => unknown,
  ) {
    this.model = model;
    this.delegate = delegate;
    this.findUnique = findUnique;
  }

  static forDelegate<Types extends SchemaTypes>(
    delegate: PrismaDelegate,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ) {
    if (!loaderCache.has(delegate)) {
      const ref = getRefFromDelegate(delegate, builder);
      const findUnique = getFindUniqueForRef(ref, builder);
      loaderCache.set(
        delegate,
        createContextCache((model) => new ModelLoader(model, delegate, findUnique!)),
      );
    }

    return loaderCache.get(delegate)!;
  }

  async loadRelation(relation: string, include: unknown, context: {}) {
    let promise;
    for (const entry of this.staged) {
      if (entry.include[relation] === undefined) {
        // eslint-disable-next-line prefer-destructuring
        promise = entry.promise;
        entry.include[relation] = include;

        break;
      }
    }

    if (!promise) {
      promise = this.initLoad(relation, include, context);
    }

    const result = await promise;

    return result[relation];
  }

  async initLoad(relation: string, includeArg: unknown, context: {}) {
    const include: Record<string, unknown> = {
      [relation]: includeArg,
    };

    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        this.staged.delete(entry);

        resolve(
          this.delegate.findUnique({
            rejectOnNotFound: true,
            where: { ...(this.findUnique(this.model, context) as {}) },
            include,
          } as never) as Promise<Record<string, unknown>>,
        );
      }, 0);
    });

    const entry = {
      promise,
      include,
    };

    this.staged.add(entry);

    return promise;
  }
}
