import { TypeMap, StoreEntry } from './types';

export default class TypeStore<Types extends TypeMap> {
  types = new Map<string, StoreEntry<Types>>();

  has(name: string) {
    return this.types.has(name);
  }

  set(name: string, entry: StoreEntry<Types>) {
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

    if (entry.kind === 'Object' || entry.kind === 'Interface' || entry.kind === 'Union') {
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

  getEntryOfType<Type extends StoreEntry<Types>['kind']>(
    name: string,
    type: Type,
  ): Extract<StoreEntry<Types>, { kind: Type }> {
    const entry = this.getEntry(name);

    if (entry.kind !== type) {
      throw new Error(`Found ${name} of kind ${entry.type.kind}, expected ${type}`);
    }

    return entry as Extract<StoreEntry<Types>, { kind: Type }>;
  }

  getEntry(name: string): StoreEntry<Types> {
    if (!this.types.has(name)) {
      throw new Error(`${name} not found in type store`);
    }

    return this.types.get(name)!;
  }
}
