import {
  createContextCache,
  type InterfaceRef,
  isThenable,
  type MaybePromise,
  type ObjectRef,
  PothosSchemaError,
  type SchemaTypes,
} from '@pothos/core';
import { absorb, acceptsFrom, cacheKey, setLoaderMappings } from '@pothos/selection-mapper';
import type { GraphQLResolveInfo } from 'graphql';
import { type PrismaPlan, prismaAdapter } from './util/adapter.js';
import { getDelegateFromModel, getModel } from './util/datamodel.js';
import { getClient } from './util/get-client.js';
import { rowPlanFromInfo } from './util/map-query.js';

interface ResolvablePromise<T> {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (err: unknown) => void;
}

export class ModelLoader {
  context: object;

  builder: PothosSchemaTypes.SchemaBuilder<never>;

  findUnique: (model: Record<string, unknown>, ctx: {}) => unknown;

  modelName: string;

  // L-4: one plan per `Type@path`, a promise while a select beneath the field is async.
  queryCache = new Map<string, MaybePromise<PrismaPlan>>();

  staged = new Set<{
    plan: PrismaPlan;
    models: Map<object, ResolvablePromise<Record<string, unknown> | null>>;
  }>();

  tick = Promise.resolve();

  constructor(
    context: object,
    builder: PothosSchemaTypes.SchemaBuilder<never>,
    modelName: string,
    findUnique: (model: Record<string, unknown>, ctx: {}) => unknown,
  ) {
    this.context = context;
    this.builder = builder;
    this.findUnique = findUnique;
    this.modelName = modelName;
  }

  static forRef<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    findUnique: ((model: Record<string, unknown>, ctx: {}) => unknown) | undefined,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ) {
    return createContextCache(
      (model) =>
        new ModelLoader(
          model,
          builder as never,
          modelName,
          findUnique === null
            ? () => {
                throw new PothosSchemaError(`Missing findUnique for ${ref.name}`);
              }
            : (findUnique ?? ModelLoader.getDefaultFindUnique(ref, modelName, builder)),
        ),
    );
  }

  static getFindUnique(
    findBy:
      | string
      | {
          name: string | null;
          fields: string[];
        },
  ): (model: Record<string, unknown>) => {} {
    if (typeof findBy === 'string') {
      return (parent) => ({ [findBy]: parent[findBy] });
    }

    const { fields, name: primaryKeyName } = findBy;

    return (parent) => {
      const primaryKey: Record<string, unknown> = {};

      for (const key of fields) {
        primaryKey[key] = parent[key];
      }

      return { [primaryKeyName ?? fields.join('_')]: primaryKey };
    };
  }

  static getDefaultFindBy<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ) {
    const model = getModel(modelName, builder);
    const idField = model.fields.find((field) => field.isId);
    const uniqueField = model.fields.find((field) => field.isRequired && field.isUnique);
    const uniqueIndex = model.uniqueIndexes.find((idx) =>
      idx.fields.every((field) => model.fields.find((f) => f.name === field)?.isRequired),
    );

    let findBy:
      | string
      | {
          name: string | null;
          fields: string[];
        }
      | undefined;

    if (model.primaryKey) {
      findBy = model.primaryKey;
    } else if (idField) {
      findBy = idField.name;
    } else if (uniqueField) {
      findBy = uniqueField.name;
    } else if (uniqueIndex) {
      findBy = uniqueIndex;
    }

    if (!findBy) {
      throw new PothosSchemaError(`Missing findUnique for ${ref.name}`);
    }

    return findBy;
  }

  static getDefaultFindUnique<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): (model: Record<string, unknown>) => {} {
    const findBy = ModelLoader.getDefaultFindBy(ref, modelName, builder);

    return ModelLoader.getFindUnique(findBy);
  }

  static getDefaultIDSelection<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): Record<string, boolean> {
    const findBy = ModelLoader.getDefaultFindBy(ref, modelName, builder);

    if (typeof findBy === 'string') {
      return { [findBy]: true };
    }

    const result: Record<string, boolean> = {};

    for (const field of findBy.fields) {
      result[field] = true;
    }

    return result;
  }

  static getCursorSelection<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    cursor: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): Record<string, boolean> {
    const model = getModel(modelName, builder);
    const field = model.fields.find((field) => field.name === cursor);

    if (field) {
      return { [field.name]: true };
    }
    const index = [model.primaryKey, ...model.uniqueIndexes]
      .filter(Boolean)
      .find((idx) => (idx!.name ?? idx!.fields.join('_')) === cursor);

    if (!index) {
      throw new PothosSchemaError(`Can't find "${cursor}" field or index for ${ref.name}`);
    }

    const selection: Record<string, boolean> = {};

    for (const column of index.fields) {
      selection[column] = true;
    }

    return selection;
  }

  static getFindUniqueForField<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    fieldName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): (model: Record<string, unknown>) => {} {
    const model = getModel(modelName, builder);

    const uniqueIndex = model.uniqueIndexes.find(
      (idx) => (idx.name ?? idx.fields.join('_')) === fieldName,
    );

    let findBy:
      | string
      | {
          name: string | null;
          fields: string[];
        }
      | undefined;

    if (model.fields.some((field) => field.name === fieldName)) {
      findBy = fieldName;
    } else if (
      model.primaryKey &&
      (model.primaryKey?.name ?? model.primaryKey?.fields.join('_')) === fieldName
    ) {
      findBy = model.primaryKey;
    } else if (uniqueIndex) {
      findBy = uniqueIndex;
    }

    if (!findBy) {
      throw new PothosSchemaError(`Unable to find field or index for ${fieldName} of ${ref.name}`);
    }

    return ModelLoader.getFindUnique(findBy);
  }

  getSelection(info: GraphQLResolveInfo) {
    const key = cacheKey(info.parentType.name, info.path);
    if (!this.queryCache.has(key)) {
      this.queryCache.set(
        key,
        rowPlanFromInfo(
          this.context,
          info,
          this.builder.options.prisma.skipDeferredFragments ?? true,
        ),
      );
    }

    return this.queryCache.get(key)!;
  }

  /**
   * L-3: `model` reloaded with the selection of the field `info` resolves. A synchronous
   * selection stages synchronously, so every row resolved in a tick joins the same batch; only a
   * selection with an async select beneath the field waits for it.
   */
  loadSelection(info: GraphQLResolveInfo, model: object): Promise<Record<string, unknown> | null> {
    const selection = this.getSelection(info);

    return isThenable(selection)
      ? selection.then((settled) => this.loadWith(settled as PrismaPlan, info, model))
      : this.loadWith(selection, info, model);
  }

  private loadWith(plan: PrismaPlan, info: GraphQLResolveInfo, model: object) {
    return this.stageQuery(plan, model).then((result) => {
      if (result) {
        const mapping = plan.mappings[`${info.parentType.name}@${info.path.key}`];

        if (mapping) {
          setLoaderMappings(this.context, info, mapping.nested);
        }
      }

      return result;
    });
  }

  stageQuery(plan: PrismaPlan, model: object) {
    const accumulator = prismaAdapter.accumulator;

    for (const entry of this.staged) {
      // Node to node: the staged plan takes the field's plan whole, never through a query.
      if (acceptsFrom(accumulator, entry.plan.root, plan.root)) {
        absorb(accumulator, entry.plan.root, plan.root);

        if (!entry.models.has(model)) {
          entry.models.set(model, createResolvablePromise<Record<string, unknown> | null>());
        }

        return entry.models.get(model)!.promise;
      }
    }

    return this.initLoad(plan, model);
  }

  initLoad(plan: PrismaPlan, initialModel: {}) {
    const delegate = getDelegateFromModel(
      getClient(this.builder, this.context as never),
      this.modelName,
    );

    const models = new Map<object, ResolvablePromise<Record<string, unknown> | null>>();

    const promise = createResolvablePromise<Record<string, unknown> | null>();
    models.set(initialModel, promise);

    const entry = {
      models,
      plan,
    };

    this.staged.add(entry);

    const nextTick = createResolvablePromise<void>();
    this.tick.then(() => {
      this.staged.delete(entry);

      for (const [model, { resolve, reject }] of entry.models) {
        if (delegate.findUniqueOrThrow) {
          delegate
            .findUniqueOrThrow({
              ...prismaAdapter.accumulator.emit(plan.root),
              where: { ...(this.findUnique(model as Record<string, unknown>, this.context) as {}) },
            } as never)
            .then(resolve as () => {}, reject);
        } else {
          delegate
            .findUnique({
              rejectOnNotFound: true,
              ...prismaAdapter.accumulator.emit(plan.root),
              where: { ...(this.findUnique(model as Record<string, unknown>, this.context) as {}) },
            } as never)
            .then(resolve as () => {}, reject);
        }
      }
    });
    setTimeout(() => nextTick.resolve(), 0);
    this.tick = nextTick.promise;

    return promise.promise;
  }
}

function createResolvablePromise<T = unknown>(): ResolvablePromise<T> {
  let resolveFn!: (value: T) => void;
  let rejectFn!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolve, reject) => {
    resolveFn = resolve;
    rejectFn = reject;
  });

  return { promise, resolve: resolveFn, reject: rejectFn };
}
