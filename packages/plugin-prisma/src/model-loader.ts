import { createContextCache, SchemaTypes } from '@pothos/core';
import { getDelegateFromModel } from './util/datamodel';
import { getClient } from './util/get-client';
import {
  mergeSelection,
  selectionCompatible,
  SelectionState,
  selectionToQuery,
} from './util/selections';

export class ModelLoader {
  model: object;
  builder: PothosSchemaTypes.SchemaBuilder<never>;
  findUnique: (args: unknown, ctx: {}) => unknown;
  modelName: string;

  staged = new Set<{
    promise: Promise<Record<string, unknown>>;
    state: SelectionState;
  }>();

  constructor(
    model: object,
    builder: PothosSchemaTypes.SchemaBuilder<never>,
    modelName: string,
    findUnique: (args: unknown, ctx: {}) => unknown,
  ) {
    this.model = model;
    this.builder = builder;
    this.findUnique = findUnique;
    this.modelName = modelName;
  }

  static forRef<Types extends SchemaTypes>(
    modelName: string,
    findUnique: (args: unknown, ctx: {}) => unknown,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ) {
    return createContextCache(
      (model) => new ModelLoader(model, builder as never, modelName, findUnique),
    );
  }

  async loadSelection(selection: SelectionState, context: object) {
    const query = selectionToQuery(selection);

    for (const entry of this.staged) {
      if (selectionCompatible(entry.state, query)) {
        mergeSelection(entry.state, query);

        return entry.promise;
      }
    }

    return this.initLoad(selection, context);
  }

  async initLoad(state: SelectionState, context: {}) {
    const entry = {
      promise: Promise.resolve().then(() => {
        this.staged.delete(entry);

        const delegate = getDelegateFromModel(
          getClient(this.builder, context as never),
          this.modelName,
        );

        return delegate.findUnique({
          rejectOnNotFound: true,
          ...selectionToQuery(state),
          where: { ...(this.findUnique(this.model, context) as {}) },
        } as never) as Promise<Record<string, unknown>>;
      }),
      state,
    };

    this.staged.add(entry);

    return entry.promise;
  }
}
