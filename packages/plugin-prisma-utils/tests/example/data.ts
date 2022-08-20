import { Character, Droid, Human } from './types';

/**
 * Copied from GraphQL JS:
 *
 * Copyright (c) 2015-present, Facebook, Inc.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */

/**
 * This defines a basic set of data for our Star Wars Schema.
 *
 * This data is hard coded for the sake of the demo, but you could imagine
 * fetching this data from a backend service rather than from hardcoded
 * JSON objects in a more complex demo.
 */

const luke = {
  type: 'Human' as const,
  id: '1000',
  name: 'Luke Skywalker',
  friends: ['1002', '1003', '2000', '2001'],
  appearsIn: [4, 5, 6],
  characterHomePlanet: 'Tatooine',
};

const vader = {
  type: 'Human' as const,
  id: '1001',
  name: 'Darth Vader',
  friends: ['1004'],
  appearsIn: [4, 5, 6],
  characterHomePlanet: 'Tatooine',
};

const han = {
  type: 'Human' as const,
  id: '1002',
  name: 'Han Solo',
  friends: ['1000', '1003', '2001'],
  appearsIn: [4, 5, 6],
};

const leia = {
  type: 'Human' as const,
  id: '1003',
  name: 'Leia Organa',
  friends: ['1000', '1002', '2000', '2001'],
  appearsIn: [4, 5, 6],
  characterHomePlanet: 'Alderaan',
};

const tarkin = {
  type: 'Human' as const,
  id: '1004',
  name: 'Wilhuff Tarkin',
  friends: ['1001'],
  appearsIn: [4],
};

const humanData: Record<string, Human> = {
  '1000': luke,
  '1001': vader,
  '1002': han,
  '1003': leia,
  '1004': tarkin,
};

const threepio = {
  type: 'Droid' as const,
  id: '2000',
  name: 'C-3PO',
  friends: ['1000', '1002', '1003', '2001'],
  appearsIn: [4, 5, 6],
  primaryFunc: 'Protocol',
};

const r2 = {
  type: 'Droid' as const,
  id: '2001',
  name: 'R2-D2',
  friends: ['1000', '1002', '1003'],
  appearsIn: [4, 5, 6],
  primaryFunc: 'Astromech',
};

const droidData: { [key in string]: Droid } = {
  '2000': threepio,
  '2001': r2,
};

/**
 * Helper function to get a character by ID.
 */
function getCharacter(id: string) {
  // Returning a promise just to illustrate GraphQL.js's support.
  return new Promise((resolve) => {
    setTimeout(() => void resolve(humanData[id] || droidData[id]), 5);
  });
}

/**
 * Allows us to query for a character's friends.
 */
export function getFriends(character: Character) {
  // Notice that GraphQL accepts Arrays of Promises.
  return character.friends.map((id) => getCharacter(id) as Promise<Human | null>);
}

/**
 * Allows us to fetch the undisputed hero of the Star Wars trilogy, R2-D2.
 */
export function getHero(episode?: number): Character {
  if (episode === 5) {
    // Luke is the hero of Episode V.
    return luke;
  }

  // r2 is the hero otherwise.
  return r2;
}

export const allHumans = Object.keys(humanData).map((key) => humanData[key]);

/**
 * Allows us to query for the human with the given id.
 */
export function getHuman(id: number | string): Human {
  return humanData[id];
}

export const allDroids = Object.keys(droidData).map((key) => droidData[key]);

/**
 * Allows us to query for the droid with the given id.
 */
export function getDroid(id: number | string): Droid {
  return droidData[id];
}
