// @ts-nocheck
import { PothosSchemaError } from '../errors.ts';
import { FieldKind, outputFieldShapeKey, PothosOutputFieldConfig, PothosTypeConfig, SchemaTypes, } from '../types/index.ts';
export class FieldRef<Types extends SchemaTypes, T = unknown, Kind extends FieldKind = FieldKind> {
    kind: FieldKind;
    fieldName?: string;
    $inferType!: T;
    [outputFieldShapeKey]!: T;
    protected pendingActions: ((config: PothosOutputFieldConfig<Types>) => PothosOutputFieldConfig<Types> | void)[] = [];
    private initConfig: ((name: string, typeConfig: PothosTypeConfig) => PothosOutputFieldConfig<Types>) | null;
    private onUseCallbacks = new Set<(config: PothosOutputFieldConfig<Types>) => void>();
    constructor(kind: Kind, initConfig: ((name: string, typeConfig: PothosTypeConfig) => PothosOutputFieldConfig<Types>) | null = null) {
        this.kind = kind;
        this.initConfig = initConfig;
    }
    updateConfig(cb: (config: PothosOutputFieldConfig<Types>) => PothosOutputFieldConfig<Types> | void) {
        this.pendingActions.push(cb);
    }
    getConfig(name: string, typeConfig: PothosTypeConfig): PothosOutputFieldConfig<Types> {
        if (!this.initConfig) {
            throw new PothosSchemaError(`Field ${typeConfig.name}.${name} has not been implemented`);
        }
        const config = this.pendingActions.reduce((cfg, cb) => cb(cfg) ?? cfg, this.initConfig(name, typeConfig));
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
