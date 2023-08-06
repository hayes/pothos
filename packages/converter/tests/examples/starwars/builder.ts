import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import { Character, ContextType, Droid, Human } from './backing-models';

interface Types {
  Objects: { Droid: Droid; Human: Human; String: string };
  Interfaces: { Character: Character };
  Context: ContextType;
}

export default new SchemaBuilder<Types>({
  plugins: [SimpleObjectsPlugin],
});
