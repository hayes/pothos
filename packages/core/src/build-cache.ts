import { BuildCacheEntry, ImplementedType, FieldMap, ResolverMap, Resolver } from './types';
import { BasePlugin, FieldBuilder, RootFieldBuilder } from '.';
import RootFieldSet from './graphql/root-field-set';
import FieldSet from './graphql/field-set';
import { GraphQLString, GraphQLInt, GraphQLID, GraphQLFloat, GraphQLBoolean } from 'graphql';
import ScalarType from './graphql/scalar';

export default class BuildCache {
  implementations: ImplementedType[];

  types = new Map<string, BuildCacheEntry>();

  fields = new Map<string, FieldMap>();

  inProgress = new Set<string>();

  plugins: BasePlugin<any>[];

  fieldDefinitions: (FieldSet<any, any> | RootFieldSet<any>)[];

  mocks: ResolverMap;

  constructor(
    implementations: ImplementedType[],
    {
      plugins,
      fieldDefinitions,
      mocks,
    }: {
      plugins?: BasePlugin[];
      fieldDefinitions?: (FieldSet<any, any> | RootFieldSet<any>)[];
      mocks?: ResolverMap;
    } = {},
  ) {
    const seenTypes = new Set<string>();

    for (const type of implementations) {
      if (seenTypes.has(type.typename)) {
        throw new Error(`Received multiple implementations of type ${type.typename}`);
      }

      seenTypes.add(type.typename);
    }

    const scalars = [GraphQLID, GraphQLInt, GraphQLFloat, GraphQLString, GraphQLBoolean];

    scalars.forEach(scalar => {
      this.types.set(scalar.name, {
        kind: 'Scalar',
        built: scalar,
        type: new ScalarType(scalar.name, {
          name: scalar.name,
          description: scalar.description ?? undefined,
          serialize: scalar.serialize,
          parseLiteral: scalar.parseLiteral,
          parseValue: scalar.parseValue,
          extensions: scalar.extensions ?? undefined,
        }),
      });
    });

    this.plugins = plugins ?? [];
    this.implementations = [...implementations];
    this.fieldDefinitions = [...(fieldDefinitions ?? [])];
    this.mocks = mocks ?? {};
  }

  addImplementation(impl: ImplementedType) {
    this.implementations.push(impl);
  }

  resolverMock(
    typename: string,
    fieldName: string,
  ): Resolver<unknown, unknown, unknown, unknown> | null {
    const fieldMock = (this.mocks[typename] && this.mocks[typename][fieldName]) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return fieldMock;
    }

    return fieldMock.resolve || null;
  }

  subscribeMock(
    typename: string,
    fieldName: string,
  ): Resolver<unknown, unknown, unknown, unknown> | null {
    const fieldMock = (this.mocks[typename] && this.mocks[typename][fieldName]) || null;

    if (!fieldMock) {
      return null;
    }

    if (typeof fieldMock === 'function') {
      return null;
    }

    return fieldMock.subscribe || null;
  }

  mergeFields(typename: string, base: FieldMap, newFields: FieldMap, allowOverwrite = false) {
    if (!allowOverwrite) {
      Object.keys(newFields).forEach(key => {
        if (base[key]) {
          throw new Error(`Duplicate field definition detected for field ${key} in ${typename}`);
        }
      });
    }

    return {
      ...base,
      ...newFields,
    };
  }

  getInterfaceFields(entry: Extract<BuildCacheEntry, { kind: 'Interface' }>): FieldMap {
    let fields = entry.type.getFields();

    this.fieldDefinitions
      .filter(set => set.forType === entry.type.typename)
      .forEach(set => {
        fields = this.mergeFields(
          entry.type.typename,
          fields,
          (set as FieldSet<any>).shape(new FieldBuilder(entry.type.typename)),
        );
      });

    for (const plugin of this.plugins) {
      if (plugin.fieldsForInterfaceType) {
        fields = plugin.fieldsForInterfaceType(entry.type, fields, entry.built, this);
      }
    }

    return fields;
  }

  getObjectFields(entry: Extract<BuildCacheEntry, { kind: 'Object' }>): FieldMap {
    const parentFields = entry.type.interfaces.reduce(
      (all, type) =>
        this.mergeFields(
          entry.type.typename,
          all,
          this.getEntryOfType(type, 'Interface').type.getFields(),
        ),
      {} as FieldMap,
    );

    let fields = this.mergeFields(entry.type.typename, parentFields, entry.type.getFields(), true);

    this.fieldDefinitions
      .filter(set => set.forType === entry.type.typename)
      .forEach(set => {
        fields = this.mergeFields(
          entry.type.typename,
          fields,
          (set as FieldSet<any>).shape(new FieldBuilder(entry.type.typename)),
        );
      });

    for (const plugin of this.plugins) {
      if (plugin.fieldsForObjectType) {
        fields = plugin.fieldsForObjectType(entry.type, fields, entry.built, this);
      }
    }

    return fields;
  }

  getRootFields(entry: Extract<BuildCacheEntry, { kind: 'Root' }>): FieldMap {
    let fields = entry.type.getFields();

    this.fieldDefinitions
      .filter(set => set.forType === entry.type.typename)
      .forEach(set => {
        fields = this.mergeFields(
          entry.type.typename,
          fields,
          (set as RootFieldSet<any>).shape(new RootFieldBuilder(entry.type.typename)),
        );
      });

    for (const plugin of this.plugins) {
      if (plugin.fieldsForRootType) {
        fields = plugin.fieldsForRootType(entry.type, fields, entry.built, this);
      }
    }

    return fields;
  }

  getFields(typename: string): FieldMap {
    if (this.fields.has(typename)) {
      return this.fields.get(typename)!;
    }

    if (this.inProgress.has(typename)) {
      throw new Error(`Found circular reference while building fields for ${typename}`);
    }

    this.inProgress.add(typename);

    const entry = this.getEntry(typename);

    if (entry.kind === 'Root') {
      return this.getRootFields(entry);
    }

    if (entry.kind === 'Interface') {
      return this.getInterfaceFields(entry);
    }

    if (entry.kind === 'Object') {
      return this.getObjectFields(entry);
    }

    throw new Error(`Type ${entry.kind} does not have fields to resolve`);
  }

  buildAll() {
    for (const type of this.implementations) {
      this.types.set(type.typename, {
        built: type.buildType(this, this.plugins),
        kind: type.kind,
        type,
      } as BuildCacheEntry);
    }

    for (const plugin of this.plugins) {
      for (const entry of this.types.values()) {
        switch (entry.kind) {
          case 'Root':
            if (plugin.visitRootType) {
              plugin.visitRootType(entry.type, entry.built, this);
            }
            break;
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

  has(name: string) {
    return this.types.has(name);
  }

  set(name: string, entry: BuildCacheEntry) {
    return this.types.set(name, entry);
  }

  getBuilt(name: string) {
    const entry = this.getEntry(name);

    if (entry.kind === 'InputObject') {
      throw new Error(`${name} is of type ${entry.type}, expected valid output type`);
    }

    return entry.built;
  }

  getBuiltInput(name: string) {
    const entry = this.getEntry(name);

    if (
      entry.kind === 'Object' ||
      entry.kind === 'Interface' ||
      entry.kind === 'Union' ||
      entry.kind === 'Root'
    ) {
      throw new Error(`${name} is of type ${entry.type}, expected valid input type`);
    }

    return entry.built;
  }

  getType(name: string) {
    return this.getEntry(name).type;
  }

  getBuiltObject(name: string) {
    const entry = this.getEntryOfType(name, 'Object');

    return entry.built;
  }

  getImplementers(typename: string) {
    const implementers = [];
    for (const entry of this.types.values()) {
      if (entry.kind === 'Object' && entry.type.interfaces.find(type => type === typename)) {
        implementers.push(entry.type);
      }
    }

    return implementers;
  }

  getEntryOfType<Type extends BuildCacheEntry['kind']>(
    name: string,
    type: Type,
  ): Extract<BuildCacheEntry, { kind: Type }> {
    const entry = this.getEntry(name);

    if (entry.kind !== type) {
      throw new Error(`Found ${name} of kind ${entry.type.kind}, expected ${type}`);
    }

    return entry as Extract<BuildCacheEntry, { kind: Type }>;
  }

  getEntry(name: string): BuildCacheEntry {
    if (!this.types.has(name)) {
      throw new Error(`${name} not found in type store`);
    }

    return this.types.get(name)!;
  }
}
