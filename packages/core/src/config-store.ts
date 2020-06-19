import { SchemaTypes, FieldMap } from './types';
import { BasePlugin } from './plugins';
import { InputType, InputFieldMap, GiraphQLTypeConfig, GiraphQLTypeKind, ConfigurableRef } from '.';

export default class ConfigStore<Types extends SchemaTypes> {
  constructor(plugin: Required<BasePlugin>) {
    this.plugin = plugin;
  }

  plugin: Required<BasePlugin>;

  typeConfigs = new Map<string, GiraphQLTypeConfig>();

  private fields = new Map<string, FieldMap[]>();

  private inputFields = new Map<string, InputFieldMap[]>();

  private refsToName = new Map<ConfigurableRef<Types>, string>();

  private pendingRefResolutions = new Map<
    ConfigurableRef<Types>,
    ((config: GiraphQLTypeConfig) => void)[]
  >();

  private pending = true;

  hasRef(ref: unknown) {
    return this.refsToName.has(ref as ConfigurableRef<Types>);
  }

  associateRefWithName(ref: ConfigurableRef<Types>, name: string) {
    if (!this.typeConfigs.has(name)) {
      throw new Error(`${name} has not been implemented yet`);
    }

    this.refsToName.set(ref, name);
  }

  addTypeConfig(config: GiraphQLTypeConfig, ref?: ConfigurableRef<Types>) {
    const { name } = config;

    if (this.typeConfigs.has(name)) {
      throw new Error(`Duplicate typename: Another type with name ${name} already exists.`);
    }

    this.typeConfigs.set(config.name, config);

    if (ref) {
      this.associateRefWithName(ref, name);
    }
  }

  resolveImplementedRef(ref: ConfigurableRef<Types>) {
    if (this.refsToName.has(ref)) {
      return this.typeConfigs.get(this.refsToName.get(ref)!)!;
    }

    throw new Error(`Ref ${ref} has not been implemented`);
  }

  resolveImplementedRefOfType<T extends GiraphQLTypeKind>(ref: ConfigurableRef<Types>, kind: T) {
    const config = this.resolveImplementedRef(ref);

    if (config.kind !== kind) {
      throw new TypeError(`Expected ref to resolve to a ${kind} type, but got ${config.kind}`);
    }

    return config;
  }

  resolveRef(ref: ConfigurableRef<Types>, cb: (config: GiraphQLTypeConfig) => void) {
    if (this.refsToName.has(ref)) {
      cb(this.resolveImplementedRef(ref));
    } else if (!this.pending) {
      throw new Error(`Ref ${ref} has not been implemented`);
    } else if (this.pendingRefResolutions.has(ref)) {
      this.pendingRefResolutions.get(ref)!.push(cb);
    } else {
      this.pendingRefResolutions.set(ref, [cb]);
    }
  }

  resolveRefOfType<T extends GiraphQLTypeKind>(
    ref: ConfigurableRef<Types>,
    kind: T,
    cb: (config: Extract<GiraphQLTypeConfig, { kind: T }>) => void,
  ) {
    this.resolveRef(ref, (config) => {
      if (config.kind !== kind) {
        throw new TypeError(`Expected ref to resolve to a ${kind} type, but got ${config.kind}`);
      }

      cb(config as Extract<GiraphQLTypeConfig, { kind: T }>);
    });
  }

  getFields(name: string) {
    return this.fields.get(name) || [];
  }

  getInputFields(name: string) {
    return this.inputFields.get(name) || [];
  }

  prepareForBuild() {
    this.pending = false;

    if (this.pendingRefResolutions.size !== 0) {
      throw new Error(
        `Missing implementations for some references (${[...this.pendingRefResolutions.keys()].join(
          ', ',
        )}).`,
      );
    }
  }

  buildFields(ref: ConfigurableRef<Types>, fields: FieldMap) {
    const { name } = this.resolveImplementedRef(ref);

    if (this.fields.has(name)) {
      this.fields.get(name)!.push(fields);
    } else {
      this.fields.set(name, [fields]);
    }
    Object.keys(fields).forEach((fieldName) => {
      // this.plugin.onField(type, fieldName, fields[fieldName], this);
    });
  }

  buildInputFields(typeRef: InputType<Types>, fields: InputFieldMap) {
    const { name } = this.resolveImplementedRef(typeRef);

    if (this.inputFields.has(name)) {
      this.inputFields.get(name)!.push(fields);
    } else {
      this.inputFields.set(name, [fields]);
    }
  }
}
