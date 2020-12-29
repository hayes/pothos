/* eslint-disable node/no-callback-literal */
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
  TypeParam,
  InputTypeParam,
  OutputType,
  InputType,
  GiraphQLObjectTypeConfig,
  GiraphQLOutputFieldConfig,
} from '.';
import BaseTypeRef from './refs/base';

export default class ConfigStore<Types extends SchemaTypes> {
  plugin: Required<BasePlugin<Types>>;

  typeConfigs = new Map<string, GiraphQLTypeConfig>();

  private fieldRefs = new WeakMap<
    FieldRef | InputFieldRef,
    (name: string) => GiraphQLFieldConfig<Types>
  >();

  private fields = new Map<string, Record<string, GiraphQLFieldConfig<Types>>>();

  private refsToName = new Map<ConfigurableRef<Types>, string>();

  private fieldRefsToConfigs = new Map<FieldRef | InputFieldRef, GiraphQLFieldConfig<Types>[]>();

  private pendingFields = new Map<FieldRef | InputFieldRef, OutputType<Types> | InputType<Types>>();

  private pendingRefResolutions = new Map<
    ConfigurableRef<Types>,
    ((config: GiraphQLTypeConfig) => void)[]
  >();

  private fieldRefCallbacks = new Map<
    FieldRef | InputFieldRef,
    ((config: GiraphQLFieldConfig<Types>) => void)[]
  >();

  private pending = true;

  constructor(plugin: Required<BasePlugin<Types>>) {
    this.plugin = plugin;
  }

  hasConfig(typeParam: InputType<Types> | OutputType<Types>) {
    if (typeof typeParam === 'string') {
      return this.typeConfigs.has(typeParam);
    }

    return this.refsToName.has(typeParam);
  }

  addFieldRef(
    ref: FieldRef | InputFieldRef,
    // We need to be able to resolve the types kind before configuring the field
    typeParam: TypeParam<Types> | InputTypeParam<Types>,
    getConfig: (name: string) => GiraphQLFieldConfig<Types>,
  ) {
    if (this.fieldRefs.has(ref)) {
      throw new Error(`FieldRef ${ref} has already been added to config store`);
    }

    const typeRefOrName = Array.isArray(typeParam) ? typeParam[0] : typeParam;

    if (this.hasConfig(typeRefOrName) || typeRefOrName instanceof BaseTypeRef) {
      this.fieldRefs.set(ref, getConfig);
    } else {
      this.pendingFields.set(ref, typeRefOrName);
      this.onTypeConfig(typeRefOrName, () => {
        this.pendingFields.delete(ref);
        this.fieldRefs.set(ref, getConfig);
      });
    }
  }

  createFieldConfig<T extends GraphQLFieldKind>(
    ref: FieldRef | InputFieldRef,
    name: string,
    kind?: T,
  ): Extract<GiraphQLFieldConfig<Types>, { graphqlKind: T }> {
    if (!this.fieldRefs.has(ref)) {
      throw new Error(`FieldRef for field named ${name} has not been added to config store yet`);
    }

    const config = this.fieldRefs.get(ref)!(name);

    if (kind && config.graphqlKind !== kind) {
      throw new TypeError(
        `Expected ref for field named ${name} to resolve to a ${kind} type, but got ${config.graphqlKind}`,
      );
    }

    if (config.kind !== 'Arg' && config.kind !== 'InputObject') {
      this.plugin.onOutputFieldConfig(config as GiraphQLOutputFieldConfig<Types>);
    } else {
      this.plugin.onInputFieldConfig(config);
    }

    return config as Extract<GiraphQLFieldConfig<Types>, { graphqlKind: T }>;
  }

  associateRefWithName(ref: ConfigurableRef<Types>, name: string) {
    if (!this.typeConfigs.has(name)) {
      throw new Error(`${name} has not been implemented yet`);
    }

    this.refsToName.set(ref, name);

    if (this.pendingRefResolutions.has(ref)) {
      const cbs = this.pendingRefResolutions.get(ref)!;

      this.pendingRefResolutions.delete(ref);

      cbs.forEach((cb) => void cb(this.typeConfigs.get(name)!));
    }
  }

  addTypeConfig(config: GiraphQLTypeConfig, ref?: ConfigurableRef<Types>) {
    const { name } = config;

    if (this.typeConfigs.has(name)) {
      throw new Error(`Duplicate typename: Another type with name ${name} already exists.`);
    }

    this.typeConfigs.set(config.name, config);

    this.plugin.onTypeConfig(config);

    if (ref) {
      this.associateRefWithName(ref, name);
    }

    if (this.pendingRefResolutions.has(name as ConfigurableRef<Types>)) {
      const cbs = this.pendingRefResolutions.get(name as ConfigurableRef<Types>)!;

      this.pendingRefResolutions.delete(name as ConfigurableRef<Types>);

      cbs.forEach((cb) => void cb(config));
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
    } else if (typeof ref === 'string' && this.typeConfigs.has(ref)) {
      cb(this.typeConfigs.get(ref)!);
    } else if (!this.pending) {
      throw new Error(`Ref ${ref} has not been implemented`);
    } else if (this.pendingRefResolutions.has(ref)) {
      this.pendingRefResolutions.get(ref)!.push(cb);
    } else {
      this.pendingRefResolutions.set(ref, [cb]);
    }
  }

  onFieldUse(ref: FieldRef | InputFieldRef, cb: (config: GiraphQLFieldConfig<Types>) => void) {
    if (!this.fieldRefCallbacks.has(ref)) {
      this.fieldRefCallbacks.set(ref, []);
    }

    this.fieldRefCallbacks.get(ref)!.push(cb);

    if (this.fieldRefsToConfigs.has(ref)) {
      this.fieldRefsToConfigs.get(ref)!.forEach((config) => void cb(config));
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

  addFields(typeRef: ConfigurableRef<Types>, fields: FieldMap | InputFieldMap) {
    this.onTypeConfig(typeRef, (config) => {
      this.buildFields(typeRef, fields);
    });
  }

  getImplementers(ref: string | ConfigurableRef<Types>) {
    const typeConfig = this.getTypeConfig(ref, 'Interface');

    const implementers = [...this.typeConfigs.values()].filter(
      (type) =>
        type.kind === 'Object' &&
        type.interfaces.find((i) => this.getTypeConfig(i).name === typeConfig.name),
    ) as GiraphQLObjectTypeConfig[];

    return implementers;
  }

  private buildFields(typeRef: ConfigurableRef<Types>, fields: FieldMap | InputFieldMap) {
    const typeConfig = this.getTypeConfig(typeRef);

    if (!this.fields.has(typeConfig.name)) {
      this.fields.set(typeConfig.name, {});
    }

    Object.keys(fields).forEach((fieldName) => {
      const fieldRef = fields[fieldName];
      if (this.pendingFields.has(fieldRef)) {
        this.onTypeConfig(this.pendingFields.get(fieldRef)!, () => {
          this.buildField(typeRef, fieldRef, fieldName);
        });
      } else {
        this.buildField(typeRef, fieldRef, fieldName);
      }
    });
  }

  private buildField(
    typeRef: ConfigurableRef<Types>,
    field: FieldRef | InputFieldRef,
    fieldName: string,
  ) {
    const typeConfig = this.getTypeConfig(typeRef);
    const fieldConfig = this.createFieldConfig(field, fieldName);
    const existingFields = this.fields.get(typeConfig.name)!;

    if (existingFields[fieldName]) {
      throw new Error(`Duplicate field definition for field ${fieldName} in ${typeConfig.name}`);
    }

    if (fieldConfig.graphqlKind !== typeConfig.graphqlKind) {
      throw new TypeError(
        `${typeConfig.name}.${fieldName} was defined as a ${fieldConfig.graphqlKind} field but ${typeConfig.name} is a ${typeConfig.graphqlKind}`,
      );
    }

    existingFields[fieldName] = fieldConfig;

    if (!this.fieldRefsToConfigs.has(field)) {
      this.fieldRefsToConfigs.set(field, []);
    }

    this.fieldRefsToConfigs.get(field)!.push(fieldConfig);

    if (this.fieldRefCallbacks.has(field)) {
      this.fieldRefCallbacks.get(field)!.forEach((cb) => void cb(fieldConfig));
    }
  }
}
