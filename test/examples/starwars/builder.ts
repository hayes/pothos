import SchemaBuilder from '../../../src';
import { Character, ContextType, Droid, Human } from './backing-models';

type Types = { Output: { Character: Character; Droid: Droid; Human: Human } };

export default new SchemaBuilder<Types, ContextType>();
