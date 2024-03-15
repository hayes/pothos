import '../test-plugin/global-types';
import SchemaBuilder from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

export interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
  FieldMode: 'v3';
}

export default new SchemaBuilder<Types>({});
