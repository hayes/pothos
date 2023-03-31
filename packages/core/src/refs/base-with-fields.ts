import {
  FieldMap,
  InterfaceParam,
  PothosInterfaceTypeConfig,
  PothosMutationTypeConfig,
  PothosObjectTypeConfig,
  PothosQueryTypeConfig,
  PothosSubscriptionTypeConfig,
  SchemaTypes,
} from '../types';
import { BaseTypeRef } from './base';
import { FieldRef } from './field';

export type ObjectLikeConfig =
  | PothosMutationTypeConfig
  | PothosObjectTypeConfig
  | PothosQueryTypeConfig
  | PothosSubscriptionTypeConfig;

export class TypeRefWithFields<
  Types extends SchemaTypes,
  Config extends ObjectLikeConfig | PothosInterfaceTypeConfig,
> extends BaseTypeRef<Types, Config> {
  private fields = new Set<() => FieldMap>();

  private fieldCbs = new Set<(name: string, ref: FieldRef<Types>) => void>();

  private interfaces: (() => InterfaceParam<Types>[])[] = [];

  addFields(fields: () => FieldMap) {
    for (const cb of this.fieldCbs) {
      for (const [name, ref] of Object.entries(fields())) {
        if (ref) {
          cb(name, ref as FieldRef<Types>);
        }
      }
    }

    this.fields.add(fields);
  }

  addInterfaces(interfaces: InterfaceParam<Types>[] | (() => InterfaceParam<Types>[])) {
    if (Array.isArray(interfaces) && interfaces.length === 0) {
      return;
    }

    if (this.preparedForBuild) {
      this.updateConfig((cfg) => ({
        ...cfg,
        interfaces: [
          ...(cfg as PothosObjectTypeConfig).interfaces,
          ...(typeof interfaces === 'function' ? interfaces() : interfaces),
        ] as InterfaceParam<SchemaTypes>[],
      }));
    } else {
      this.interfaces.push(() => (Array.isArray(interfaces) ? interfaces : interfaces()));
    }
  }

  onField(cb: (name: string, ref: FieldRef<Types>) => void) {
    this.fieldCbs.add(cb);
    for (const fieldMap of this.fields) {
      for (const [name, ref] of Object.entries(fieldMap())) {
        if (ref) {
          cb(name, ref as FieldRef<Types>);
        }
      }
    }
  }

  override prepareForBuild(): void {
    if (this.preparedForBuild) {
      return;
    }
    super.prepareForBuild();

    if (this.interfaces.length > 0) {
      this.updateConfig((cfg) => ({
        ...cfg,
        interfaces: [
          ...((cfg as PothosObjectTypeConfig).interfaces ?? []),
          ...this.interfaces.flatMap((interfaces) => interfaces()),
        ] as InterfaceParam<SchemaTypes>[],
      }));
    }
  }
}
