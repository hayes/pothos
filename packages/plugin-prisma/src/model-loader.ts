import { createContextCache, ObjectRef, SchemaTypes } from '@pothos/core';
import { getDelegateFromModel, getModel } from './util/datamodel';
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
    ref: ObjectRef<unknown>,
    modelName: string,
    findUnique: (args: unknown, ctx: {}) => unknown,
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
                throw new Error(`Missing findUnique for ${ref.name}`);
              }
            : findUnique ?? this.getDefaultFindUnique(ref, modelName, builder),
        ),
    );
  }

  static getFindUnique(
    findBy:
      | {
          name: string | null;
          fields: string[];
        }
      | string,
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
    ref: ObjectRef<unknown>,
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
      | {
          name: string | null;
          fields: string[];
        }
      | string
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
      throw new Error(`Missing findUnique for ${ref.name}`);
    }

    return findBy;
  }

  static getDefaultFindUnique<Types extends SchemaTypes>(
    ref: ObjectRef<unknown>,
    modelName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): (model: Record<string, unknown>) => {} {
    const findBy = this.getDefaultFindBy(ref, modelName, builder);

    return this.getFindUnique(findBy);
  }

  static getDefaultIDSelection<Types extends SchemaTypes>(
    ref: ObjectRef<unknown>,
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
    ref: ObjectRef<unknown>,
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
      throw new Error(`Can't find "${cursor}" field or index for ${ref.name}`);
    }

    const selection: Record<string, boolean> = {};

    for (const column of index.fields) {
      selection[column] = true;
    }

    return selection;
  }

  static getFindUniqueForField<Types extends SchemaTypes>(
    ref: ObjectRef<unknown>,
    modelName: string,
    fieldName: string,
    builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ): (model: Record<string, unknown>) => {} {
    const model = getModel(modelName, builder);

    const uniqueIndex = model.uniqueIndexes.find(
      (idx) => (idx.name ?? idx.fields.join('_')) === fieldName,
    );

    let findBy:
      | {
          name: string | null;
          fields: string[];
        }
      | string
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
      throw new Error(`Unable to find field or index for ${fieldName} of ${ref.name}`);
    }

    return this.getFindUnique(findBy);
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

        if (delegate.findUniqueOrThrow) {
          return delegate.findUniqueOrThrow({
            ...selectionToQuery(state),
            where: { ...(this.findUnique(this.model, context) as {}) },
          } as never) as Promise<Record<string, unknown>>;
        }

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
