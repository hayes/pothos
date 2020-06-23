/* eslint-disable max-classes-per-file */
import { GraphQLResolveInfo } from 'graphql';
import { GiraphQLObjectTypeConfig, ResolveHooks, SchemaTypes, MaybePromise } from '..';

export class ValueWrapper<T> {
  protected value: unknown;

  getData: () => MaybePromise<T | null>;

  fieldResults = new Map<string, unknown>();

  constructor(value: unknown, data: T | null) {
    this.value = value;
    this.getData = () => data;
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

  type: GiraphQLObjectTypeConfig | null = null;

  hooks: ResolveHooks<Types, T>;

  constructor(value: unknown, index: number | null, hooks: ResolveHooks<Types, T>) {
    super(value, null);

    this.index = index;
    this.hooks = hooks;
  }

  private updateValue(value: unknown) {
    if (value == null) {
      // TODO track parent and update field results?
      throw new TypeError('Updating with null value not supported yet');
    } else if (value instanceof Promise) {
      throw new TypeError('Update value must be resolved before calling updateValue');
    }

    if (this.value === value) {
      return;
    }

    this.value = value;

    if (this.fieldResults.size) {
      this.fieldResults = new Map();
    }

    if (this.type) {
      this.queueDataUpdate(this.type);
    }
  }

  async updateData(type: GiraphQLObjectTypeConfig) {
    this.queueDataUpdate(type);

    await this.getData();
  }

  private queueDataUpdate(type: GiraphQLObjectTypeConfig) {
    if (this.hooks.onChild) {
      this.getData = () => {
        const data = this.hooks.onChild!(this.value, this.index, type, (next) =>
          this.updateValue(next),
        );

        this.getData = () => data ?? null;

        return data ?? null;
      };
    }
  }
}
