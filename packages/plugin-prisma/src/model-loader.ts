import { GraphQLResolveInfo } from 'graphql';
import {
  createContextCache,
  InterfaceRef,
  ObjectRef,
  PothosSchemaError,
  SchemaTypes,
} from '@pothos/core';
import { PrismaDelegate, SelectionMap } from './types';
import { getDelegateFromModel, getModel } from './util/datamodel';
import { getClient } from './util/get-client';
import { cacheKey, setLoaderMappings } from './util/loader-map';
import { selectionStateFromInfo } from './util/map-query';
import {
  mergeSelection,
  selectionCompatible,
  SelectionState,
  selectionToQuery,
} from './util/selections';

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

  queryCache = new Map<string, { selection: SelectionState; query: SelectionMap }>();

  staged = new Set<{
    state: SelectionState;
    models: Map<object, ResolvablePromise<Record<string, unknown> | null>>;
  }>();

  delegate: PrismaDelegate;

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
    this.delegate = getDelegateFromModel(
      getClient(this.builder, this.context as never),
      this.modelName,
    );
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
            : findUnique ?? this.getDefaultFindUnique(ref, modelName, builder),
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
    const findBy = this.getDefaultFindBy(ref, modelName, builder);

    return this.getFindUnique(findBy);
  }

  static getDefaultIDSelection<Types extends SchemaTypes>(
    ref: InterfaceRef<Types, unknown> | ObjectRef<Types, unknown>,
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): Record<string, boolean> {
    const findBy = this.getDefaultFindBy(ref, modelName, builder);

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

    return this.getFindUnique(findBy);
  }

  getSelection(info: GraphQLResolveInfo) {
    const key = cacheKey(info.parentType.name, info.path);
    if (!this.queryCache.has(key)) {
      const selection = selectionStateFromInfo(this.context, info);
      this.queryCache.set(key, {
        selection,
        query: selectionToQuery(selection),
      });
    }

    return this.queryCache.get(key)!;
  }

  async loadSelection(info: GraphQLResolveInfo, model: object) {
    const { selection, query } = this.getSelection(info);

    const result = await this.stageQuery(selection, query, model);

    if (result) {
      const mappings = selection.mappings[info.path.key];

      if (mappings) {
        setLoaderMappings(this.context, info, mappings.mappings);
      }
    }

    return result;
  }

  async stageQuery(selection: SelectionState, query: SelectionMap, model: object) {
    for (const entry of this.staged) {
      if (selectionCompatible(entry.state, query)) {
        mergeSelection(entry.state, query);

        if (!entry.models.has(model)) {
          entry.models.set(model, createResolvablePromise<Record<string, unknown> | null>());
        }

        return entry.models.get(model)!.promise;
      }
    }

    return this.initLoad(selection, model);
  }

  async initLoad(state: SelectionState, initialModel: {}) {
    const models = new Map<object, ResolvablePromise<Record<string, unknown> | null>>();

    const promise = createResolvablePromise<Record<string, unknown> | null>();
    models.set(initialModel, promise);

    const entry = {
      models,
      state,
    };

    this.staged.add(entry);

    const nextTick = createResolvablePromise<void>();
    void this.tick.then(() => {
      this.staged.delete(entry);

      for (const [model, { resolve, reject }] of entry.models) {
        if (this.delegate.findUniqueOrThrow) {
          void this.delegate
            .findUniqueOrThrow({
              ...selectionToQuery(state),
              where: { ...(this.findUnique(model as Record<string, unknown>, this.context) as {}) },
            } as never)
            // eslint-disable-next-line promise/no-nesting
            .then(resolve as () => {}, reject);
        } else {
          void this.delegate
            .findUnique({
              rejectOnNotFound: true,
              ...selectionToQuery(state),
              where: { ...(this.findUnique(model as Record<string, unknown>, this.context) as {}) },
            } as never)
            // eslint-disable-next-line promise/no-nesting
            .then(resolve as () => {}, reject);
        }
      }
    });
    setTimeout(() => void nextTick.resolve(), 0);
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
