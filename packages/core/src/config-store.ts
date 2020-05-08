import {
  GraphQLObjectTypeConfig,
  GraphQLInterfaceTypeConfig,
  GraphQLUnionTypeConfig,
  GraphQLScalarTypeConfig,
  GraphQLEnumTypeConfig,
  GraphQLInputObjectTypeConfig,
  GraphQLFieldConfigMap,
} from 'graphql';
import { OutputType, SchemaTypes, FieldMap, WithFieldsParam, RootName } from './types';
import { BasePlugin } from './plugins';

type GraphQLKinds = 'objects' | 'interfaces' | 'unions' | 'enums' | 'scalars' | 'inputs';

export default class ConfigStore<Types extends SchemaTypes> {
  constructor(plugin: Required<BasePlugin>) {
    this.plugin = plugin;
  }

  private plugin: Required<BasePlugin>;

  private pending = true;

  private nameToKind = new Map<string, GraphQLKinds>();

  private objects = new Map<
    string,
    Omit<GraphQLObjectTypeConfig<unknown, object>, 'fields' | 'interfaces'>
  >();

  private interfaces = new Map<
    string,
    Omit<GraphQLInterfaceTypeConfig<unknown, object>, 'fields'>
  >();

  private unions = new Map<string, Omit<GraphQLUnionTypeConfig<unknown, object>, 'types'>>();

  private enums = new Map<string, GraphQLEnumTypeConfig>();

  private scalars = new Map<string, GraphQLScalarTypeConfig<unknown, unknown>>();

  private inputs = new Map<string, Omit<GraphQLInputObjectTypeConfig, 'fields'>>();

  private fields = new Map<WithFieldsParam<Types>, FieldMap[]>();

  private refsToName = new Map<OutputType<Types> | RootName, string>();

  private pendingFields = new Map<OutputType<Types> | RootName, (() => FieldMap)[]>();

  getNameFromRef(ref: OutputType<Types> | RootName) {
    if (!this.refsToName.has(ref)) {
      throw new Error('No typename registered for ref');
    }

    return this.refsToName.get(ref)!;
  }

  associateRefWithName(ref: OutputType<Types>, type: string) {
    if (this.refsToName.has(ref)) {
      throw new Error(`Ref cannot be associated with multiple type names`);
    }

    this.refsToName.set(ref, type);
  }

  registerUniqueName(name: string, kind: GraphQLKinds) {
    if (this.nameToKind.has(name)) {
      throw new Error(`Duplicate typename ${name}`);
    }

    this.nameToKind.set(name, kind);
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

  addFieldConfig(
    ref: WithFieldsParam<Types>,
    config: () => GraphQLFieldConfigMap<unknown, object>,
  ) {
    if (!this.fields.has(ref)) {
      this.fields.set(ref, []);
    }

    // this.fields.get(ref)!.push(config);
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

  buildPendingFields() {
    if (!this.pending) {
      return;
    }

    this.pending = false;

    this.refsToName.forEach((name, ref) => {
      if (this.pendingFields.has(ref)) {
        this.pendingFields.get(ref)!.forEach((fn) => {
          this.buildFields(ref as WithFieldsParam<Types>, fn());
        });

        this.pendingFields.delete(ref);
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
    this.getNameFromRef(typeRef);

    if (this.fields.has(typeRef)) {
      this.fields.get(typeRef)!.push(fields);
    } else {
      this.fields.set(typeRef, [fields]);
    }
    Object.keys(fields).forEach((fieldName) => {
      // this.plugin.onField(type, fieldName, fields[fieldName], this);
    });
  }
}
