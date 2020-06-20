import { SchemaTypes, FieldMap } from './types';
import { BasePlugin } from './plugins';
import {
  GiraphQLTypeConfig,
  ConfigurableRef,
  FieldRef,
  GiraphQLFieldConfig,
  InputFieldRef,
  InputFieldMap,
  GraphQLFieldKind,
} from '.';

export default class ConfigStore<Types extends SchemaTypes> {
  constructor(plugin: Required<BasePlugin>) {
    this.plugin = plugin;
  }

  plugin: Required<BasePlugin>;

  typeConfigs = new Map<string, GiraphQLTypeConfig>();

  private fieldRefs = new WeakMap<
    FieldRef | InputFieldRef,
    (name: string) => GiraphQLFieldConfig<Types>
  >();

  private fields = new Map<string, Record<string, GiraphQLFieldConfig<Types>>>();

  private refsToName = new Map<ConfigurableRef<Types>, string>();

  private pendingRefResolutions = new Map<
    ConfigurableRef<Types>,
    ((config: GiraphQLTypeConfig) => void)[]
  >();

  private pending = true;

  hasRef(ref: unknown) {
    return this.refsToName.has(ref as ConfigurableRef<Types>);
  }

  addFieldRef(
    ref: FieldRef | InputFieldRef,
    getConfig: (name: string) => GiraphQLFieldConfig<Types>,
  ) {
    if (this.fieldRefs.has(ref)) {
      throw new Error(`FieldRef ${ref} has already been added to config store`);
    }

    this.fieldRefs.set(ref, getConfig);
  }

  getFieldConfig<T extends GraphQLFieldKind>(
    ref: FieldRef | InputFieldRef,
    name: string,
    kind?: T,
  ): Extract<GiraphQLFieldConfig<Types>, { graphqlKind: T }> {
    if (!this.fieldRefs.has(ref)) {
      throw new Error(`FieldRef ${ref} has not been added to config store`);
    }

    const config = this.fieldRefs.get(ref)!(name);

    if (kind && config.graphqlKind !== kind) {
      throw new TypeError(
        `Expected ref to resolve to a ${kind} type, but got ${config.graphqlKind}`,
      );
    }

    return config as Extract<GiraphQLFieldConfig<Types>, { graphqlKind: T }>;
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

  getTypeConfig<T extends GiraphQLTypeConfig['kind']>(
    ref: string | ConfigurableRef<Types>,
    kind?: T,
  ) {
    let config: GiraphQLTypeConfig;

    if (typeof ref === 'string') {
      if (!this.typeConfigs.has(ref)) {
        throw new Error(`Type ${ref} has not been implemented`);
      }
      config = this.typeConfigs.get(ref)!;
    } else if (this.refsToName.has(ref)) {
      config = this.typeConfigs.get(this.refsToName.get(ref)!)!;
    } else {
      throw new Error(`Ref ${ref} has not been implemented`);
    }

    if (kind && config.graphqlKind !== kind) {
      throw new TypeError(`Expected ref to resolve to a ${kind} type, but got ${config.kind}`);
    }

    return config as Extract<GiraphQLTypeConfig, { kind: T }>;
  }

  onTypeConfig(ref: ConfigurableRef<Types>, cb: (config: GiraphQLTypeConfig) => void) {
    if (this.refsToName.has(ref)) {
      cb(this.getTypeConfig(ref));
    } else if (!this.pending) {
      throw new Error(`Ref ${ref} has not been implemented`);
    } else if (this.pendingRefResolutions.has(ref)) {
      this.pendingRefResolutions.get(ref)!.push(cb);
    } else {
      this.pendingRefResolutions.set(ref, [cb]);
    }
  }

  getFields<T extends GraphQLFieldKind>(
    name: string,
    kind?: T,
  ): Record<string, Extract<GiraphQLFieldConfig<Types>, { graphqlKind: T }>> {
    const typeConfig = this.getTypeConfig(name);
    const fields = this.fields.get(name) || [];

    if (kind && typeConfig.graphqlKind !== kind) {
      throw new TypeError(
        `Expected ${name} to be a ${kind} type, but found ${typeConfig.graphqlKind}`,
      );
    }

    return fields as Record<string, Extract<GiraphQLFieldConfig<Types>, { graphqlKind: T }>>;
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

  buildFields(typeRef: ConfigurableRef<Types>, fields: FieldMap | InputFieldMap) {
    const typeConfig = this.getTypeConfig(typeRef);

    if (!this.fields.has(typeConfig.name)) {
      this.fields.set(typeConfig.name, {});
    }

    const existingFields = this.fields.get(typeConfig.name)!;

    Object.keys(fields).forEach((fieldName) => {
      if (existingFields[fieldName]) {
        throw new Error(`Duplicate field definition for field ${fieldName} in ${typeConfig.name}`);
      }

      const fieldConfig = this.getFieldConfig(fields[fieldName], fieldName);

      if (fieldConfig.kind !== typeConfig.graphqlKind) {
        throw new TypeError('test');
      }

      existingFields[fieldName] = fieldConfig;
    });
  }
}
