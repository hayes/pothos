export type Episode = 'NEWHOPE' | 'EMPIRE' | 'JEDI';

export interface CharacterFields {
  id: string;
  name: string;
  friends: string[];
  appearsIn: readonly number[];
}

export interface Human extends CharacterFields {
  type: 'Human';
  characterHomePlanet?: string;
}

export interface Droid extends CharacterFields {
  type: 'Droid';
  primaryFunc: string;
}

export type Character = Human | Droid;

export type ContextType = {};
