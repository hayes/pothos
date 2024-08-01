import {
  type FieldKind,
  type PothosOutputFieldConfig,
  type PothosTypeConfig,
  type SchemaTypes,
  outputFieldShapeKey,
} from '../types';

export class FieldRef<Types extends SchemaTypes, T = unknown, Kind extends FieldKind = FieldKind> {
  kind: FieldKind;

  fieldName?: string;

  $inferType!: T;

  [outputFieldShapeKey]!: T;

  protected pendingActions: ((
    config: PothosOutputFieldConfig<Types>,
  ) => PothosOutputFieldConfig<Types> | undefined)[] = [];

  private initConfig: (
    name: string,
    typeConfig: PothosTypeConfig,
  ) => PothosOutputFieldConfig<Types>;

  private onUseCallbacks = new Set<(config: PothosOutputFieldConfig<Types>) => void>();

  constructor(
    kind: Kind,
    initConfig: (name: string, typeConfig: PothosTypeConfig) => PothosOutputFieldConfig<Types>,
  ) {
    this.kind = kind;
    this.initConfig = initConfig;
  }

  updateConfig(
    cb: (config: PothosOutputFieldConfig<Types>) => PothosOutputFieldConfig<Types> | undefined,
  ) {
    this.pendingActions.push(cb);
  }

  getConfig(name: string, typeConfig: PothosTypeConfig): PothosOutputFieldConfig<Types> {
    const config = this.pendingActions.reduce(
      (cfg, cb) => cb(cfg) ?? cfg,
      this.initConfig(name, typeConfig),
    );

    for (const cb of this.onUseCallbacks) {
      this.onUseCallbacks.delete(cb);
      cb(config);
    }

    return config;
  }

  onFirstUse(cb: (config: PothosOutputFieldConfig<Types>) => void) {
    this.onUseCallbacks.add(cb);
  }
}
