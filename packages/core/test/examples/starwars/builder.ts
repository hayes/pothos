import SchemaBuilder from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

type Types = {
  Object: { Droid: Droid; Human: Human; String: string };
  Interface: { Character: Character };
  Context: ContextType;
};

export default new SchemaBuilder<Types>();
