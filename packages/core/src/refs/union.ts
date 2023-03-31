import type { PothosUnionTypeConfig, SchemaTypes } from '../types';
import { ObjectParam, OutputRef, outputShapeKey, parentShapeKey } from '../types/type-params';
import { BaseTypeRef } from './base';

export class UnionRef<Types extends SchemaTypes, T, P = T>
  extends BaseTypeRef<Types, PothosUnionTypeConfig>
  implements OutputRef, PothosSchemaTypes.UnionRef<Types, T, P>
{
  override kind = 'Union' as const;

  $inferType!: T;

  [outputShapeKey]!: T;

  [parentShapeKey]!: P;

  private types: (() => ObjectParam<Types>[])[] = [];

  constructor(name: string, config?: PothosUnionTypeConfig) {
    super('Union', name, config);
  }

  addTypes(types: ObjectParam<Types>[] | (() => ObjectParam<Types>[])) {
    if (Array.isArray(types) && types.length === 0) {
      return;
    }

    if (this.preparedForBuild) {
      this.updateConfig((cfg) => ({
        ...cfg,
        types: [
          ...cfg.types,
          ...(typeof types === 'function' ? types() : types),
        ] as ObjectParam<SchemaTypes>[],
      }));
    } else {
      this.types.push(() => (Array.isArray(types) ? types : types()));
    }
  }

  override prepareForBuild(): void {
    if (this.preparedForBuild) {
      return;
    }
    super.prepareForBuild();

    if (this.types.length > 0) {
      this.updateConfig((cfg) => ({
        ...cfg,
        types: [
          ...cfg.types,
          ...this.types.flatMap((types) => types()),
        ] as ObjectParam<SchemaTypes>[],
      }));
    }
  }
}
