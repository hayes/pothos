/* eslint-disable max-classes-per-file */
import { GraphQLResolveInfo } from 'graphql';
import { GiraphQLObjectTypeConfig, ResolveHooks, SchemaTypes, MaybePromise } from '..';

export class ValueWrapper<T> {
  value: unknown;

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

  updateQueued = false;

  constructor(value: unknown, index: number | null, hooks: ResolveHooks<Types, T>) {
    super(value, null);

    this.index = index;
    this.hooks = hooks;
  }

  private updateValue(value: unknown) {
    if (value == null) {
      // TODO track parent and update field results?
      throw new Error('Updating with null value not supported yet');
    }

    if (this.value === value) {
      return;
    }

    if (this.type) {
      this.queueDataUpdate(this.type);
    }

    if (this.fieldResults.size) {
      this.fieldResults = new Map();
    }

    this.value = value;
  }

  async updateData(type: GiraphQLObjectTypeConfig) {
    this.queueDataUpdate(type);

    await this.getData();
  }

  private queueDataUpdate(type: GiraphQLObjectTypeConfig) {
    if (this.hooks.onChild && !this.updateQueued) {
      this.updateQueued = true;
      this.getData = () => {
        this.updateQueued = false;

        const data = this.hooks.onChild!(this.value, this.index, type, (next) =>
          this.updateValue(next),
        );

        this.getData = () => data ?? null;

        return data ?? null;
      };
    }
  }
}
