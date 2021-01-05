/* eslint-disable max-classes-per-file */
import { GraphQLResolveInfo } from 'graphql';
import { types } from 'util';

import { GiraphQLObjectTypeConfig, ResolveHooks, SchemaTypes, MaybePromise } from '..';
import { assertArray } from '../utils';

export class ValueWrapper<T> {
  getData: () => MaybePromise<T | null>;

  fieldResults = new Map<string, unknown>();

  protected value: unknown;

  constructor(value: unknown, data: T | null) {
    this.value = value;
    this.getData = () => data;
  }

  setFieldResult(info: GraphQLResolveInfo, result: unknown) {
    const key = String(info.path.key);

    return this.fieldResults.set(key, result);
  }

  hasFieldResult(info: GraphQLResolveInfo) {
    const key = String(info.path.key);

    return this.fieldResults.has(key);
  }

  getFieldResult(info: GraphQLResolveInfo, isList: boolean) {
    const key = String(info.path.key);

    const result = this.fieldResults.get(key);

    if (!result) {
      return result;
    }

    if (isList && assertArray(result)) {
      return result.map((itemOrPromise) => {
        if (types.isPromise(itemOrPromise)) {
          return (itemOrPromise as Promise<unknown>).then((item: unknown) =>
            item instanceof ValueWrapper ? item.asResolvable() : result,
          );
        }

        return itemOrPromise instanceof ValueWrapper ? itemOrPromise.asResolvable() : result;
      });
    }

    return result instanceof ValueWrapper ? result.asResolvable() : result;
  }

  unwrap() {
    return this.value;
  }

  private asResolvable() {
    if (types.isPromise(this.value)) {
      return (this.value as Promise<unknown>).then((value) => (value == null ? null : this));
    }

    return this.value == null ? null : this;
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

  updateData(type: GiraphQLObjectTypeConfig) {
    this.queueDataUpdate(type);

    return this.getData();
  }

  private updateValue(value: unknown) {
    this.value = value;

    if (this.fieldResults.size) {
      this.fieldResults = new Map<string, unknown>();
    }

    if (this.value == null) {
      this.getData = () => null;
    } else if (this.type) {
      this.queueDataUpdate(this.type);
    }
  }

  private queueDataUpdate(type: GiraphQLObjectTypeConfig) {
    if (this.hooks.onChild) {
      this.getData = () => {
        const data = this.hooks.onChild!(
          this.value,
          this.index,
          type,
          (next) => void this.updateValue(next),
        );

        this.getData = () => data ?? null;

        return data ?? null;
      };
    }
  }
}
