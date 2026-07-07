// User-overlay state — favorites, reading lists, and annotations layered on
// top of the (read-only) canon. Mutations operate on these maps.

export interface IUser {
  id: string;
  username: string;
  displayName: string;
}

export type FavoriteTarget = 'Character' | 'Location' | 'Item' | 'Quote';

export interface IFavorite {
  id: string;
  userId: string;
  targetType: FavoriteTarget;
  targetId: string;
}

export interface IReadingList {
  id: string;
  userId: string;
  name: string;
  bookIds: string[];
}

export interface IAnnotation {
  id: string;
  userId: string;
  quoteId: string;
  text: string;
}

export const Users = new Map<string, IUser>([
  ['u-frodo-fan', { id: 'u-frodo-fan', username: 'frodo-fan', displayName: 'Frodo Fan' }],
  ['u-elf-friend', { id: 'u-elf-friend', username: 'elf-friend', displayName: 'Elf Friend' }],
  ['u-archivist', { id: 'u-archivist', username: 'archivist', displayName: 'The Archivist' }],
]);

export const Favorites = new Map<string, IFavorite>([
  ['fav-1', { id: 'fav-1', userId: 'u-frodo-fan', targetType: 'Character', targetId: 'c-frodo' }],
  ['fav-2', { id: 'fav-2', userId: 'u-frodo-fan', targetType: 'Quote', targetId: 'q-4' }],
  [
    'fav-3',
    { id: 'fav-3', userId: 'u-elf-friend', targetType: 'Character', targetId: 'c-galadriel' },
  ],
  [
    'fav-4',
    { id: 'fav-4', userId: 'u-elf-friend', targetType: 'Location', targetId: 'l-lothlorien' },
  ],
]);

export const ReadingLists = new Map<string, IReadingList>([
  [
    'rl-1',
    {
      id: 'rl-1',
      userId: 'u-frodo-fan',
      name: 'The Main Quest',
      bookIds: ['bk-fotr', 'bk-tt', 'bk-rotk'],
    },
  ],
  ['rl-2', { id: 'rl-2', userId: 'u-elf-friend', name: 'Elven Lore', bookIds: ['bk-fotr'] }],
]);

export const Annotations = new Map<string, IAnnotation>([
  [
    'a-1',
    {
      id: 'a-1',
      userId: 'u-archivist',
      quoteId: 'q-2',
      text: 'Said at the Bridge of Khazad-dûm, before the Balrog.',
    },
  ],
  [
    'a-2',
    {
      id: 'a-2',
      userId: 'u-elf-friend',
      quoteId: 'q-9',
      text: 'Galadriel to Frodo, in Lothlórien.',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function favoritesForUser(userId: string): IFavorite[] {
  return [...Favorites.values()].filter((f) => f.userId === userId);
}

export function readingListsForUser(userId: string): IReadingList[] {
  return [...ReadingLists.values()].filter((rl) => rl.userId === userId);
}

export function annotationsForUser(userId: string): IAnnotation[] {
  return [...Annotations.values()].filter((a) => a.userId === userId);
}

/** Monotonic id generator for mutation-created records, scoped per kind. */
let nextSeq = 1000;
export function nextId(prefix: string): string {
  nextSeq += 1;
  return `${prefix}-${nextSeq}`;
}
