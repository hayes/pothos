/* eslint-disable max-classes-per-file */
import { GraphQLResolveInfo } from 'graphql';
import { GiraphQLObjectTypeConfig, ResolveHooks, SchemaTypes } from '..';

export class ValueWrapper<T> {
  value: unknown;

  data: T | null;

  fieldResults = new Map<string, unknown>();

  constructor(value: unknown, data: T | null) {
    this.value = value;
    this.data = data;
  }

  setFieldResult(info: GraphQLResolveInfo, result: unknown) {
    const key = String(info.path.key);

    this.fieldResults.set(key, result);
  }

  hasFieldResult(info: GraphQLResolveInfo) {
    const key = String(info.path.key);

    this.fieldResults.has(key);
  }

  getFieldResult(info: GraphQLResolveInfo) {
    const key = String(info.path.key);

    this.fieldResults.get(key);
  }

  unwrap() {
    return this.value;
  }
}

export class ResolveValueWrapper<Types extends SchemaTypes, T> extends ValueWrapper<T> {
  index: number | null;

  hooks: ResolveHooks<Types, T>;

  constructor(value: unknown, index: number | null, hooks: ResolveHooks<Types, T>) {
    super(value, null);

    this.index = index;
    this.hooks = hooks;
  }

  async updateValue(value: unknown, type: GiraphQLObjectTypeConfig) {
    if (value == null) {
      // TODO track parent and update field results?
      throw new Error('Updating with null value not supported yet');
    }

    if (value !== this.value) {
      if (this.hooks.onChild) {
        this.data = (await this.hooks.onChild(value, this.index, type)) ?? null;
      }

      this.value = value;
      this.fieldResults = new Map();
    }
  }
}
