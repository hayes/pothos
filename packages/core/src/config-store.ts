import { OutputType, SchemaTypes, FieldMap, WithFieldsParam, RootName } from './types';
import { BasePlugin } from './plugins';
import { InputType, InputFieldMap, GiraphQLTypeConfig } from '.';

export default class ConfigStore<Types extends SchemaTypes> {
  constructor(plugin: Required<BasePlugin>) {
    this.plugin = plugin;
  }

  plugin: Required<BasePlugin>;

  typeConfigs = new Map<string, GiraphQLTypeConfig>();

  private fields = new Map<string, FieldMap[]>();

  private inputFields = new Map<string, InputFieldMap[]>();

  private refsToName = new Map<OutputType<Types> | InputType<Types> | RootName, string>();

  private pendingFields = new Map<
    OutputType<Types> | InputType<Types> | RootName,
    (() => FieldMap)[]
  >();

  private pendingInputFields = new Map<
    OutputType<Types> | InputType<Types> | RootName,
    (() => InputFieldMap)[]
  >();

  private pending = true;

  hasRef(ref: unknown) {
    return this.refsToName.has(ref as OutputType<Types> | InputType<Types>);
  }

  getNameFromRef(ref: OutputType<Types> | InputType<Types> | RootName) {
    if (typeof ref === 'string') {
      return ref;
    }

    if (!this.refsToName.has(ref)) {
      throw new Error('No typename registered for ref');
    }

    return this.refsToName.get(ref)!;
  }

  associateRefWithName(ref: OutputType<Types> | InputType<Types>, type: string) {
    this.refsToName.set(ref, type);
  }

  addTypeConfig(config: GiraphQLTypeConfig) {
    const { name } = config;

    if (this.typeConfigs.has(name)) {
      throw new Error(`Duplicate typename: Another type with name ${name} already exists.`);
    }

    this.typeConfigs.set(config.name, config);
  }

  addFields(type: WithFieldsParam<Types>, fields: () => FieldMap) {
    if (this.pending) {
      if (this.pendingFields.has(type)) {
        this.pendingFields.get(type)!.push(fields);
      } else {
        this.pendingFields.set(type, [fields]);
      }
    } else {
      this.buildFields(type, fields());
    }
  }

  addInputFields(type: InputType<Types>, fields: () => InputFieldMap) {
    if (this.pending) {
      if (this.pendingInputFields.has(type)) {
        this.pendingInputFields.get(type)!.push(fields);
      } else {
        this.pendingInputFields.set(type, [fields]);
      }
    } else {
      this.buildInputFields(type, fields());
    }
  }

  getFields(name: string) {
    return this.fields.get(name) || [];
  }

  getInputFields(name: string) {
    return this.inputFields.get(name) || [];
  }

  buildPendingFields() {
    if (!this.pending) {
      return;
    }

    this.pending = false;

    const namesAndRefs = [
      ...this.refsToName.values(),
      ...this.refsToName.keys(),
      'Query',
      'Mutation',
      'Subscription',
    ] as (OutputType<Types> | RootName)[];

    namesAndRefs.forEach((ref) => {
      if (this.pendingFields.has(ref)) {
        this.pendingFields.get(ref)!.forEach((fn) => {
          this.buildFields(ref as WithFieldsParam<Types>, fn());
        });

        this.pendingFields.delete(ref);
      }

      if (this.pendingInputFields.has(ref)) {
        this.pendingInputFields.get(ref)!.forEach((fn) => {
          this.buildInputFields(ref as InputType<Types>, fn());
        });

        this.pendingInputFields.delete(ref);
      }
    });

    if (this.pendingFields.size) {
      // TODO: figure out how to fix names for references
      throw new Error(
        `Fields defined without defining type (${[...this.pendingFields.keys()].join(', ')}).`,
      );
    }
  }

  buildFields(typeRef: WithFieldsParam<Types>, fields: FieldMap) {
    const name = this.getNameFromRef(typeRef);

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
    const name = this.getNameFromRef(typeRef);

    if (this.inputFields.has(name)) {
      this.inputFields.get(name)!.push(fields);
    } else {
      this.inputFields.set(name, [fields]);
    }
  }
}
