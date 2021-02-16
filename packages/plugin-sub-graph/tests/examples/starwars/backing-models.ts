export type Episode = 'EMPIRE' | 'JEDI' | 'NEWHOPE';

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

export type Character = Droid | Human;

// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface ContextType {}
