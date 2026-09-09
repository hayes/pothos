export interface ICharacter {
  id: string;
  name: string;
  raceId: string;
}

export interface IRace {
  id: string;
  name: string;
}

export const Races = new Map<string, IRace>([
  ['hobbit', { id: 'hobbit', name: 'Hobbit' }],
  ['elf', { id: 'elf', name: 'Elf' }],
]);

export const Characters: ICharacter[] = [
  { id: 'frodo', name: 'Frodo Baggins', raceId: 'hobbit' },
  { id: 'legolas', name: 'Legolas', raceId: 'elf' },
];
