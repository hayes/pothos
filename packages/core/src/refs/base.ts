import { PothosSchemaError } from '../errors';
import type { SchemaTypes } from '../types';

export class BaseTypeRef<Types extends SchemaTypes, T = unknown>
  implements PothosSchemaTypes.BaseTypeRef<Types, T>
{
  kind;

  name;

  association: BaseTypeRef<Types, T> | string | null = null;

  protected configCallbacks = new Set<(config: T) => void>();

  protected preparedForBuild = false;

  private currentConfig: T | null;

  constructor(
    kind:
      | 'Enum'
      | 'InputList'
      | 'InputObject'
      | 'Interface'
      | 'List'
      | 'Object'
      | 'Scalar'
      | 'Union',
    name: string,
    config?: T | null,
  ) {
    this.kind = kind;
    this.name = name;
    this.currentConfig = config ?? null;
  }

  toString() {
    return `${this.kind}Ref<${this.name}>`;
  }

  associate(ref: BaseTypeRef<Types, T> | string) {
    if (this.association && typeof this.associate !== 'string') {
      throw new PothosSchemaError(`${this} is already associated with ${this.association}`);
    }

    this.association = ref;
  }

  onConfig(cb: (config: T) => T | void) {
    this.configCallbacks.add(cb);
    if (this.currentConfig) {
      cb(this.currentConfig);
    }
  }

  updateConfig(config: T | ((oldConfig: T) => T)) {
    if (typeof config === 'function') {
      this.onceOnConfig((oldConfig) => {
        this.updateConfig((config as (oldConfig: T) => T)(oldConfig));
      });
      return;
    }

    this.currentConfig = config;

    for (const cb of this.configCallbacks) {
      if (this.currentConfig !== config) {
        break;
      }

      cb(config);
    }
  }

  prepareForBuild() {
    this.preparedForBuild = true;
  }

  protected onceOnConfig(cb: (config: T) => T | void) {
    const callback = (config: T) => {
      this.configCallbacks.delete(callback);
      cb(config);
    };

    this.onConfig(callback);
  }
}
