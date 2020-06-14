import {
  GraphQLObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLUnionTypeConfig,
  GraphQLScalarTypeConfig,
  GraphQLEnumTypeConfig,
  GraphQLInputObjectTypeConfig,
} from 'graphql';
import { OutputType, SchemaTypes, FieldMap, WithFieldsParam, RootName } from './types';
import { BasePlugin } from './plugins';
import { InputType, InputFieldMap } from '.';

type GraphQLKinds = 'objects' | 'interfaces' | 'unions' | 'enums' | 'scalars' | 'inputs';

export default class ConfigStore<Types extends SchemaTypes> {
  constructor(plugin: Required<BasePlugin>) {
    this.plugin = plugin;
  }

  nameToKind = new Map<string, GraphQLKinds>();

  objects = new Map<
    string,
    Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'>
  >();

  interfaces = new Map<string, Omit<GraphQLInterfaceTypeConfig<unknown, object>, 'fields'>>();

  unions = new Map<string, Omit<GraphQLUnionTypeConfig<unknown, object>, 'types'>>();

  enums = new Map<string, GraphQLEnumTypeConfig>();

  scalars = new Map<string, GraphQLScalarTypeConfig<unknown, unknown>>();

  inputs = new Map<string, Omit<GraphQLInputObjectTypeConfig, 'fields'>>();

  plugin: Required<BasePlugin>;

  private unionMembers = new Map<string, OutputType<Types>[]>();

  private implementedInterfaces = new Map<string, OutputType<Types>[]>();

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

  addObjectConfig(config: Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'>) {
    this.registerUniqueName(config.name, 'objects');
    this.objects.set(config.name, config);
  }

  addInterfaceConfig(config: Omit<GraphQLInterfaceTypeConfig<unknown, object>, 'fields'>) {
    this.registerUniqueName(config.name, 'interfaces');
    this.interfaces.set(config.name, config);
  }

  addUnionConfig(config: Omit<GraphQLUnionTypeConfig<unknown, object>, 'types'>) {
    this.registerUniqueName(config.name, 'unions');
    this.unions.set(config.name, config);
  }

  addEnumConfig(config: GraphQLEnumTypeConfig) {
    this.registerUniqueName(config.name, 'enums');
    this.enums.set(config.name, config);
  }

  addScalarConfig(config: GraphQLScalarTypeConfig<unknown, unknown>) {
    this.registerUniqueName(config.name, 'scalars');
    this.scalars.set(config.name, config);
  }

  addInputConfig(config: Omit<GraphQLInputObjectTypeConfig, 'fields'>) {
    this.registerUniqueName(config.name, 'inputs');
    this.inputs.set(config.name, config);
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

  addUnionMembers(type: string, members: OutputType<Types>[]) {
    if (!this.unionMembers.has(type)) {
      this.unionMembers.set(type, []);
    }

    this.unionMembers.get(type)!.push(...members);
  }

  getUnionMembers(type: string) {
    return (this.unionMembers.get(type) || []).map((ref) => this.getNameFromRef(ref));
  }

  setImplementedInterfaces(type: string, interfaces: OutputType<Types>[]) {
    this.implementedInterfaces.set(type, interfaces);
  }

  getImplementedInterfaces(type: string) {
    return this.implementedInterfaces.get(type) || [];
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

  private registerUniqueName(name: string, kind: GraphQLKinds) {
    if (this.nameToKind.has(name)) {
      throw new Error(`Duplicate typename ${name}`);
    }

    this.nameToKind.set(name, kind);
  }
}
