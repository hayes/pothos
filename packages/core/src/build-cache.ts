import { GraphQLString, GraphQLInt, GraphQLID, GraphQLFloat, GraphQLBoolean } from 'graphql';
import {
  BuildCacheEntry,
  ImplementedType,
  FieldMap,
  ResolverMap,
  Resolver,
  RootName,
} from './types';
import { BasePlugin } from '.';
import ScalarType from './graphql/scalar';

export default class BuildCache {
  implementations: ImplementedType[];

  types = new Map<string, BuildCacheEntry>();

  plugin: Required<BasePlugin>;

  fieldDefinitions: Map<string, FieldMap[]>;

  mocks: ResolverMap;

  constructor(
    implementations: ImplementedType[],
    plugin: Required<BasePlugin>,
    {
      fieldDefinitions,
      mocks,
    }: {
      fieldDefinitions?: Map<string, FieldMap[]>;
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

    this.plugin = plugin;
    this.implementations = [...implementations];
    this.fieldDefinitions = fieldDefinitions || new Map();
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
    return (this.fieldDefinitions.get(entry.type.typename) || []).reduce(
      (fields, newFields) => this.mergeFields(entry.type.typename, fields, newFields),
      {} as FieldMap,
    );
  }

  getObjectFields(entry: Extract<BuildCacheEntry, { kind: 'Object' }>): FieldMap {
    const interfaceFields = entry.type.interfaces.reduce(
      (all, type) => this.mergeFields(entry.type.typename, all, this.getFields(type)),
      {} as FieldMap,
    );

    return (this.fieldDefinitions.get(entry.type.typename) || []).reduce(
      (fields, newFields, i) => this.mergeFields(entry.type.typename, fields, newFields),
      interfaceFields,
    );
  }

  getRootFields(entry: Extract<BuildCacheEntry, { kind: RootName }>): FieldMap {
    return (this.fieldDefinitions.get(entry.type.typename) || []).reduce(
      (fields, newFields) => this.mergeFields(entry.type.typename, fields, newFields),
      {} as FieldMap,
    );
  }

  getFields(typename: string): FieldMap {
    const entry = this.getEntry(typename);

    if (entry.kind === 'Query' || entry.kind === 'Mutation' || entry.kind === 'Subscription') {
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

  buildType(type: ImplementedType) {
    this.types.set(type.typename, {
      built: type.buildType(this, this.plugin),
      kind: type.kind,
      type,
    } as BuildCacheEntry);
  }

  buildAll() {
    for (const type of this.implementations) {
      this.buildType(type);
    }

    for (const entry of this.types.values()) {
      this.plugin.visitType(entry, this);
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
      entry.kind === 'Query' ||
      entry.kind === 'Mutation' ||
      entry.kind === 'Subscription'
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
