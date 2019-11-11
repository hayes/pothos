import { BuildCacheEntry, ImplementedType, FieldMap, NamedTypeParam } from './types';
import { BasePlugin, InterfaceType } from '.';
import BaseType from './graphql/base';

export default class BuildCache<
  Types extends GiraphQLSchemaTypes.TypeInfo,
  Key extends string | keyof Types['Input'] | keyof Types['Output'] =
    | string
    | keyof Types['Input']
    | keyof Types['Output']
> {
  implementations: ImplementedType<Types>[];

  types = new Map<Key, BuildCacheEntry<Types>>();

  fields = new Map<Key, FieldMap<Types>>();

  inProgress = new Set<Key>();

  plugins: BasePlugin<Types>[];

  constructor(implementations: ImplementedType<Types>[], plugins: BasePlugin<Types>[]) {
    const seenTypes = new Set<Key>();

    for (const type of implementations) {
      if (seenTypes.has(type.typename)) {
        throw new Error(`Received multiple implementations of type ${type.typename}`);
      }

      seenTypes.add(type.typename);
    }

    this.plugins = plugins;
    this.implementations = implementations;
  }

  mergeFields(base: FieldMap<Types>, newFields: FieldMap<Types>) {
    return {
      ...base,
      ...newFields,
    };
  }

  getInterfaceFields(
    entry: Extract<BuildCacheEntry<Types>, { kind: 'Interface' }>,
  ): FieldMap<Types> {
    return entry.type.getFields();
  }

  getObjectFields(entry: Extract<BuildCacheEntry<Types>, { kind: 'Object' }>): FieldMap<Types> {
    const parentFields = (entry.type.interfaces as InterfaceType<
      {},
      Types,
      NamedTypeParam<Types>
    >[]).reduce(
      (all, type) => ({
        ...all,
        ...type.getFields(),
      }),
      {} as FieldMap<Types>,
    );

    return {
      ...parentFields,
      ...entry.type.getFields(parentFields),
    };
  }

  getFields(typename: Key): FieldMap<Types> {
    if (this.fields.has(typename)) {
      return this.fields.get(typename)!;
    }

    if (this.inProgress.has(typename)) {
      throw new Error(`Found circular reference while building fields for ${typename}`);
    }

    this.inProgress.add(typename);

    const entry = this.getEntry(typename);

    if (entry.kind === 'Interface') {
      const fields = this.getInterfaceFields(entry);

      return fields;
    }

    if (entry.kind === 'Object') {
      const fields = this.getObjectFields(entry);

      return fields;
    }

    throw new Error(`Type ${entry.kind} does not have fields to resolve`);
  }

  buildAll() {
    for (const type of this.implementations) {
      this.types.set(type.typename, {
        built: type.buildType(this, this.plugins),
        kind: type.kind,
        type,
      } as BuildCacheEntry<Types>);
    }

    for (const plugin of this.plugins) {
      for (const entry of this.types.values()) {
        switch (entry.kind) {
          case 'Object':
            if (plugin.visitObjectType) {
              plugin.visitObjectType(entry.type, entry.built, this);
            }
            break;
          case 'Enum':
            if (plugin.visitEnumType) {
              plugin.visitEnumType(entry.type, entry.built, this);
            }
            break;
          case 'InputObject':
            if (plugin.visitInputObjectType) {
              plugin.visitInputObjectType(entry.type, entry.built, this);
            }
            break;
          case 'Interface':
            if (plugin.visitInterfaceType) {
              plugin.visitInterfaceType(entry.type, entry.built, this);
            }
            break;
          case 'Scalar':
            if (plugin.visitScalarType) {
              plugin.visitScalarType(entry.type, entry.built, this);
            }
            break;
          case 'Union':
            if (plugin.visitUnionType) {
              plugin.visitUnionType(entry.type, entry.built, this);
            }
            break;
          default:
            break;
        }
      }
    }
  }

  has(name: Key) {
    return this.types.has(name);
  }

  set(name: Key, entry: BuildCacheEntry<Types>) {
    return this.types.set(name, entry);
  }

  getBuilt(name: Key) {
    const entry = this.getEntry(name);

    if (entry.kind === 'InputObject') {
      throw new Error(`${name} is of type ${entry.type}, expected valid output type`);
    }

    return entry.built;
  }

  getBuiltInput(name: Key) {
    const entry = this.getEntry(name);

    if (entry.kind === 'Object' || entry.kind === 'Interface' || entry.kind === 'Union') {
      throw new Error(`${name} is of type ${entry.type}, expected valid input type`);
    }

    return entry.built;
  }

  getType(name: Key) {
    return this.getEntry(name).type;
  }

  getBuiltObject(name: Key) {
    const entry = this.getEntryOfType(name, 'Object');

    return entry.built;
  }

  getImplementers(typename: Key) {
    const implementers = [];
    for (const entry of this.types.values()) {
      if (
        entry.kind === 'Object' &&
        (entry.type.interfaces as BaseType<Types, Key, {}>[]).find(
          type => type.typename === typename,
        )
      ) {
        implementers.push(entry.type);
      }
    }

    return implementers;
  }

  getEntryOfType<Type extends BuildCacheEntry<Types>['kind']>(
    name: Key,
    type: Type,
  ): Extract<BuildCacheEntry<Types>, { kind: Type }> {
    const entry = this.getEntry(name);

    if (entry.kind !== type) {
      throw new Error(`Found ${name} of kind ${entry.type.kind}, expected ${type}`);
    }

    return entry as Extract<BuildCacheEntry<Types>, { kind: Type }>;
  }

  getEntry(name: Key): BuildCacheEntry<Types> {
    if (!this.types.has(name)) {
      throw new Error(`${name} not found in type store`);
    }

    return this.types.get(name)!;
  }
}
