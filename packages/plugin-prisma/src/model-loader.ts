import { createContextCache, SchemaTypes } from '@pothos/core';
import { PrismaDelegate } from './types';
import { getDelegateFromModel } from './util/datamodel';
import {
  mergeSelection,
  selectionCompatible,
  SelectionState,
  selectionToQuery,
} from './util/selections';

export class ModelLoader {
  model: object;
  delegate: PrismaDelegate;
  findUnique: (args: unknown, ctx: {}) => unknown;

  staged = new Set<{
    promise: Promise<Record<string, unknown>>;
    state: SelectionState;
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

  static forRef<Types extends SchemaTypes>(
    modelName: string,
    findUnique: (args: unknown, ctx: {}) => unknown,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ) {
    const delegate = getDelegateFromModel(builder.options.prisma.client, modelName);

    return createContextCache((model) => new ModelLoader(model, delegate, findUnique));
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
    const promise = new Promise<Record<string, unknown>>((resolve, reject) => {
      setTimeout(() => {
        this.staged.delete(entry);

        resolve(
          this.delegate.findUnique({
            rejectOnNotFound: true,
            ...selectionToQuery(state),
            where: { ...(this.findUnique(this.model, context) as {}) },
          } as never) as Promise<Record<string, unknown>>,
        );
      }, 0);
    });

    const entry = {
      promise,
      state,
    };

    this.staged.add(entry);

    return promise;
  }
}
