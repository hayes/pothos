import { PothosSchemaError } from '../errors';
import {
  inputFieldShapeKey,
  PothosInputFieldConfig,
  PothosTypeConfig,
  SchemaTypes,
} from '../types';

export class ArgumentRef<Types extends SchemaTypes, T = unknown> {
  kind = 'Arg' as const;

  fieldName?: string;

  [inputFieldShapeKey]!: T;

  protected pendingActions: ((
    config: PothosInputFieldConfig<Types>,
  ) => PothosInputFieldConfig<Types> | void)[] = [];

  private initConfig:
    | ((name: string, field: string, typeConfig: PothosTypeConfig) => PothosInputFieldConfig<Types>)
    | null;

  private onUseCallbacks = new Set<(config: PothosInputFieldConfig<Types>) => void>();

  constructor(
    initConfig:
      | ((
          name: string,
          field: string,
          typeConfig: PothosTypeConfig,
        ) => PothosInputFieldConfig<Types>)
      | null = null,
  ) {
    this.initConfig = initConfig;
  }

  onConfig(cb: (config: PothosInputFieldConfig<Types>) => PothosInputFieldConfig<Types> | void) {
    this.pendingActions.push(cb);
  }

  updateConfig(
    cb: (config: PothosInputFieldConfig<Types>) => PothosInputFieldConfig<Types> | void,
  ) {
    this.pendingActions.push(cb);
  }

  getConfig(
    name: string,
    field: string,
    typeConfig: PothosTypeConfig,
  ): PothosInputFieldConfig<Types> {
    if (!this.initConfig) {
      throw new PothosSchemaError(`Field ${typeConfig.name}.${name} has not been implemented`);
    }

    const config = this.pendingActions.reduce(
      (config, cb) => cb(config) ?? config,
      this.initConfig(name, field, typeConfig),
    );

    for (const cb of this.onUseCallbacks) {
      this.onUseCallbacks.delete(cb);
      cb(config);
    }

    return config;
  }

  onFirstUse(cb: (config: PothosInputFieldConfig<Types>) => void) {
    this.onUseCallbacks.add(cb);
  }
}
