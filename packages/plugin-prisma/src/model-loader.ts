/* eslint-disable prefer-destructuring */
/* eslint-disable no-underscore-dangle */
import { createContextCache, SchemaTypes } from '@giraphql/core';
import { getDelegateFromModel, getFindUniqueForRef, getRefFromModel } from './refs';
import { PrismaDelegate } from './types';
import { mergeIncludes } from './util';

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

  static forModel<Types extends SchemaTypes>(
    modelName: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ) {
    const delegate = getDelegateFromModel(builder.options.prisma.client, modelName);

    if (!loaderCache.has(delegate)) {
      const ref = getRefFromModel(modelName, builder);

      const findUnique = getFindUniqueForRef(ref, builder);
      loaderCache.set(
        delegate,
        createContextCache((model) => new ModelLoader(model, delegate, findUnique!)),
      );
    }

    return loaderCache.get(delegate)!;
  }

  async loadCount(relation: string, context: {}): Promise<number> {
    let promise;
    const entry = [...this.staged][0];

    if (entry) {
      if (!entry.include._count) {
        entry.include._count = { select: {} };
      }

      (entry.include._count as { select: Record<string, boolean> }).select[relation] = true;
      promise = entry.promise;
    } else {
      promise = this.initLoad(relation, null, context, true);
    }

    const result = await promise;

    return (result._count as Record<string, number>)[relation];
  }

  async loadRelation(relation: string, include: unknown, context: {}) {
    let promise;
    for (const entry of this.staged) {
      if (entry.include[relation] === undefined) {
        promise = entry.promise;
        entry.include[relation] = include;

        break;
      }

      const merged = mergeIncludes(
        entry.include[relation] as Record<string, unknown>,
        include as Record<string, unknown>,
      );

      if (merged) {
        entry.include[relation] = merged;
        break;
      }
    }

    if (!promise) {
      promise = this.initLoad(relation, include, context);
    }

    const result = await promise;

    return result[relation];
  }

  async initLoad(relation: string, includeArg: unknown, context: {}, count = false) {
    const include: Record<string, unknown> = count
      ? {
          _count: {
            select: {
              [relation]: true,
            },
          },
        }
      : {
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
