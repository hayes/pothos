// In-memory canon dataset for the Lord of the Rings example.
// Data is hand-curated from public sources (Tolkien Gateway / LOTR Wiki).
// Every record has a stable slug id so cross-references stay readable.

// ---------------------------------------------------------------------------
// Races
// ---------------------------------------------------------------------------

export interface IRace {
  id: string;
  name: string;
  lifespan: string;
  originLocationId?: string;
}

export const Races = new Map<string, IRace>([
  [
    'r-hobbit',
    { id: 'r-hobbit', name: 'Hobbit', lifespan: 'mortal, ~100 years', originLocationId: 'l-shire' },
  ],
  ['r-man', { id: 'r-man', name: 'Man', lifespan: 'mortal (Númenóreans longer-lived)' }],
  ['r-elf', { id: 'r-elf', name: 'Elf', lifespan: 'immortal', originLocationId: 'l-lothlorien' }],
  [
    'r-dwarf',
    {
      id: 'r-dwarf',
      name: 'Dwarf',
      lifespan: 'long-lived, ~250 years',
      originLocationId: 'l-moria',
    },
  ],
  ['r-wizard', { id: 'r-wizard', name: 'Wizard', lifespan: 'Maia spirit in mortal form' }],
  ['r-orc', { id: 'r-orc', name: 'Orc', lifespan: 'mortal', originLocationId: 'l-mordor' }],
]);

// ---------------------------------------------------------------------------
// Locations (discriminated)
// ---------------------------------------------------------------------------

interface ILocationBase {
  id: string;
  name: string;
}

export interface IRealm extends ILocationBase {
  kind: 'Realm';
  ruler?: string;
}
export interface ISettlement extends ILocationBase {
  kind: 'Settlement';
  realmId?: string;
}
export interface IWilderness extends ILocationBase {
  kind: 'Wilderness';
  terrain: string;
}
export interface IStronghold extends ILocationBase {
  kind: 'Stronghold';
  controlledBy?: string;
}

export type ILocation = IRealm | ISettlement | IWilderness | IStronghold;

export const Locations = new Map<string, ILocation>([
  // Realms
  ['l-shire', { kind: 'Realm', id: 'l-shire', name: 'The Shire', ruler: 'Thain of the Shire' }],
  ['l-gondor', { kind: 'Realm', id: 'l-gondor', name: 'Gondor', ruler: 'Steward Denethor II' }],
  ['l-rohan', { kind: 'Realm', id: 'l-rohan', name: 'Rohan', ruler: 'King Théoden' }],
  [
    'l-lothlorien',
    {
      kind: 'Realm',
      id: 'l-lothlorien',
      name: 'Lothlórien',
      ruler: 'Lord Celeborn and Lady Galadriel',
    },
  ],
  ['l-mordor', { kind: 'Realm', id: 'l-mordor', name: 'Mordor', ruler: 'Sauron' }],

  // Settlements
  ['l-hobbiton', { kind: 'Settlement', id: 'l-hobbiton', name: 'Hobbiton', realmId: 'l-shire' }],
  ['l-bree', { kind: 'Settlement', id: 'l-bree', name: 'Bree' }],
  ['l-rivendell', { kind: 'Settlement', id: 'l-rivendell', name: 'Rivendell' }],
  ['l-edoras', { kind: 'Settlement', id: 'l-edoras', name: 'Edoras', realmId: 'l-rohan' }],
  [
    'l-minas-tirith',
    { kind: 'Settlement', id: 'l-minas-tirith', name: 'Minas Tirith', realmId: 'l-gondor' },
  ],

  // Wilderness
  [
    'l-mirkwood',
    { kind: 'Wilderness', id: 'l-mirkwood', name: 'Mirkwood', terrain: 'dense forest' },
  ],
  [
    'l-fangorn',
    { kind: 'Wilderness', id: 'l-fangorn', name: 'Fangorn Forest', terrain: 'ancient forest' },
  ],
  [
    'l-misty-mountains',
    {
      kind: 'Wilderness',
      id: 'l-misty-mountains',
      name: 'Misty Mountains',
      terrain: 'mountain range',
    },
  ],

  // Strongholds
  [
    'l-helms-deep',
    { kind: 'Stronghold', id: 'l-helms-deep', name: "Helm's Deep", controlledBy: 'Rohan' },
  ],
  [
    'l-isengard',
    { kind: 'Stronghold', id: 'l-isengard', name: 'Isengard', controlledBy: 'Saruman' },
  ],
  [
    'l-barad-dur',
    { kind: 'Stronghold', id: 'l-barad-dur', name: 'Barad-dûr', controlledBy: 'Sauron' },
  ],
  [
    'l-moria',
    {
      kind: 'Stronghold',
      id: 'l-moria',
      name: 'Moria',
      controlledBy: 'abandoned (Balrog, then Orcs)',
    },
  ],
  [
    'l-erebor',
    { kind: 'Stronghold', id: 'l-erebor', name: 'Erebor', controlledBy: 'King Under the Mountain' },
  ],
]);

// ---------------------------------------------------------------------------
// Items (discriminated)
// ---------------------------------------------------------------------------

interface IItemBase {
  id: string;
  name: string;
  forgedBy?: string;
}

export interface IWeapon extends IItemBase {
  kind: 'Weapon';
  weaponType: string;
  wielderIds: string[];
}
export interface IRingOfPower extends IItemBase {
  kind: 'RingOfPower';
  inscription?: string;
  /** Ordered list of character ids — the chain of bearers. */
  bearerHistory: string[];
}
export interface IArtifact extends IItemBase {
  kind: 'Artifact';
  powerDescription: string;
}

export type IItem = IWeapon | IRingOfPower | IArtifact;

export const Items = new Map<string, IItem>([
  // Weapons
  [
    'i-anduril',
    {
      kind: 'Weapon',
      id: 'i-anduril',
      name: 'Andúril',
      weaponType: 'longsword',
      forgedBy: 'Elves of Rivendell (reforged from Narsil)',
      wielderIds: ['c-aragorn'],
    },
  ],
  [
    'i-sting',
    {
      kind: 'Weapon',
      id: 'i-sting',
      name: 'Sting',
      weaponType: 'short sword',
      forgedBy: 'Gondolin Elves',
      wielderIds: ['c-bilbo', 'c-frodo', 'c-sam'],
    },
  ],
  [
    'i-glamdring',
    {
      kind: 'Weapon',
      id: 'i-glamdring',
      name: 'Glamdring',
      weaponType: 'longsword',
      forgedBy: 'Gondolin Elves',
      wielderIds: ['c-gandalf'],
    },
  ],
  [
    'i-orcrist',
    {
      kind: 'Weapon',
      id: 'i-orcrist',
      name: 'Orcrist',
      weaponType: 'longsword',
      forgedBy: 'Gondolin Elves',
      wielderIds: ['c-thorin'],
    },
  ],

  // Rings of Power
  [
    'i-one-ring',
    {
      kind: 'RingOfPower',
      id: 'i-one-ring',
      name: 'The One Ring',
      forgedBy: 'Sauron, in the fires of Orodruin',
      inscription:
        'One Ring to rule them all, One Ring to find them, One Ring to bring them all, and in the darkness bind them.',
      bearerHistory: ['c-bilbo', 'c-frodo', 'c-sam', 'c-frodo'],
    },
  ],
  [
    'i-narya',
    {
      kind: 'RingOfPower',
      id: 'i-narya',
      name: 'Narya',
      forgedBy: 'Celebrimbor',
      bearerHistory: ['c-gandalf'],
    },
  ],
  [
    'i-nenya',
    {
      kind: 'RingOfPower',
      id: 'i-nenya',
      name: 'Nenya',
      forgedBy: 'Celebrimbor',
      bearerHistory: ['c-galadriel'],
    },
  ],
  [
    'i-vilya',
    {
      kind: 'RingOfPower',
      id: 'i-vilya',
      name: 'Vilya',
      forgedBy: 'Celebrimbor',
      bearerHistory: ['c-elrond'],
    },
  ],

  // Artifacts
  [
    'i-palantir-orthanc',
    {
      kind: 'Artifact',
      id: 'i-palantir-orthanc',
      name: 'Palantír of Orthanc',
      forgedBy: 'Fëanor',
      powerDescription: 'A seeing-stone, one of seven, used to communicate across great distances.',
    },
  ],
  [
    'i-mithril-shirt',
    {
      kind: 'Artifact',
      id: 'i-mithril-shirt',
      name: 'Mithril Shirt',
      forgedBy: 'Dwarves of Erebor',
      powerDescription: 'A coat of mithril mail, light as a feather and harder than dragon-scale.',
    },
  ],
  [
    'i-phial-of-galadriel',
    {
      kind: 'Artifact',
      id: 'i-phial-of-galadriel',
      name: 'Phial of Galadriel',
      powerDescription:
        "A crystal phial holding the light of Eärendil's star; gleams in dark places.",
    },
  ],
]);

// ---------------------------------------------------------------------------
// Characters (discriminated by race)
// ---------------------------------------------------------------------------

interface ICharacterBase {
  id: string;
  name: string;
  raceId: string;
  factionIds: string[];
}

export interface IHobbit extends ICharacterBase {
  kind: 'Hobbit';
  shireAddress?: string;
}
export interface IElf extends ICharacterBase {
  kind: 'Elf';
  house?: string;
  departed: boolean;
}
export interface IMan extends ICharacterBase {
  kind: 'Man';
  kingdom?: string;
  descent?: string;
}
export interface IDwarf extends ICharacterBase {
  kind: 'Dwarf';
  clan?: string;
}
export interface IWizard extends ICharacterBase {
  kind: 'Wizard';
  order: 'Istari';
  color: string;
}
export interface IOrc extends ICharacterBase {
  kind: 'Orc';
  subtype: 'Orc' | 'Uruk-hai';
  overlordName?: string;
}

export type ICharacter = IHobbit | IElf | IMan | IDwarf | IWizard | IOrc;

export const Characters = new Map<string, ICharacter>([
  // Hobbits
  [
    'c-frodo',
    {
      kind: 'Hobbit',
      id: 'c-frodo',
      name: 'Frodo Baggins',
      raceId: 'r-hobbit',
      factionIds: ['f-fellowship'],
      shireAddress: 'Bag End, Hobbiton',
    },
  ],
  [
    'c-sam',
    {
      kind: 'Hobbit',
      id: 'c-sam',
      name: 'Samwise Gamgee',
      raceId: 'r-hobbit',
      factionIds: ['f-fellowship'],
      shireAddress: '3 Bagshot Row, Hobbiton',
    },
  ],
  [
    'c-merry',
    {
      kind: 'Hobbit',
      id: 'c-merry',
      name: 'Meriadoc Brandybuck',
      raceId: 'r-hobbit',
      factionIds: ['f-fellowship', 'f-rohan'],
      shireAddress: 'Brandy Hall, Buckland',
    },
  ],
  [
    'c-pippin',
    {
      kind: 'Hobbit',
      id: 'c-pippin',
      name: 'Peregrin Took',
      raceId: 'r-hobbit',
      factionIds: ['f-fellowship', 'f-gondor-army'],
      shireAddress: 'Great Smials, Tuckborough',
    },
  ],
  [
    'c-bilbo',
    {
      kind: 'Hobbit',
      id: 'c-bilbo',
      name: 'Bilbo Baggins',
      raceId: 'r-hobbit',
      factionIds: ['f-thorin-company'],
      shireAddress: 'Bag End, Hobbiton',
    },
  ],

  // Men
  [
    'c-aragorn',
    {
      kind: 'Man',
      id: 'c-aragorn',
      name: 'Aragorn',
      raceId: 'r-man',
      factionIds: ['f-fellowship', 'f-gondor-army'],
      kingdom: 'Gondor',
      descent: 'Númenórean (Dúnedain)',
    },
  ],
  [
    'c-boromir',
    {
      kind: 'Man',
      id: 'c-boromir',
      name: 'Boromir',
      raceId: 'r-man',
      factionIds: ['f-fellowship', 'f-gondor-army'],
      kingdom: 'Gondor',
      descent: 'Númenórean (Dúnedain)',
    },
  ],
  [
    'c-faramir',
    {
      kind: 'Man',
      id: 'c-faramir',
      name: 'Faramir',
      raceId: 'r-man',
      factionIds: ['f-gondor-army'],
      kingdom: 'Gondor',
      descent: 'Númenórean (Dúnedain)',
    },
  ],
  [
    'c-denethor',
    {
      kind: 'Man',
      id: 'c-denethor',
      name: 'Denethor II',
      raceId: 'r-man',
      factionIds: ['f-gondor-army'],
      kingdom: 'Gondor',
      descent: 'Númenórean (Dúnedain)',
    },
  ],
  [
    'c-theoden',
    {
      kind: 'Man',
      id: 'c-theoden',
      name: 'Théoden',
      raceId: 'r-man',
      factionIds: ['f-rohan'],
      kingdom: 'Rohan',
      descent: 'Rohirric',
    },
  ],
  [
    'c-eomer',
    {
      kind: 'Man',
      id: 'c-eomer',
      name: 'Éomer',
      raceId: 'r-man',
      factionIds: ['f-rohan'],
      kingdom: 'Rohan',
      descent: 'Rohirric',
    },
  ],
  [
    'c-eowyn',
    {
      kind: 'Man',
      id: 'c-eowyn',
      name: 'Éowyn',
      raceId: 'r-man',
      factionIds: ['f-rohan'],
      kingdom: 'Rohan',
      descent: 'Rohirric',
    },
  ],

  // Elves
  [
    'c-legolas',
    {
      kind: 'Elf',
      id: 'c-legolas',
      name: 'Legolas',
      raceId: 'r-elf',
      factionIds: ['f-fellowship'],
      house: 'Woodland Realm',
      departed: false,
    },
  ],
  [
    'c-elrond',
    {
      kind: 'Elf',
      id: 'c-elrond',
      name: 'Elrond',
      raceId: 'r-elf',
      factionIds: ['f-white-council'],
      house: 'Rivendell',
      departed: true,
    },
  ],
  [
    'c-galadriel',
    {
      kind: 'Elf',
      id: 'c-galadriel',
      name: 'Galadriel',
      raceId: 'r-elf',
      factionIds: ['f-white-council'],
      house: 'Lothlórien',
      departed: true,
    },
  ],
  [
    'c-arwen',
    {
      kind: 'Elf',
      id: 'c-arwen',
      name: 'Arwen Undómiel',
      raceId: 'r-elf',
      factionIds: [],
      house: 'Rivendell',
      departed: false,
    },
  ],
  [
    'c-glorfindel',
    {
      kind: 'Elf',
      id: 'c-glorfindel',
      name: 'Glorfindel',
      raceId: 'r-elf',
      factionIds: [],
      house: 'Rivendell',
      departed: false,
    },
  ],

  // Dwarves
  [
    'c-gimli',
    {
      kind: 'Dwarf',
      id: 'c-gimli',
      name: 'Gimli',
      raceId: 'r-dwarf',
      factionIds: ['f-fellowship'],
      clan: "Longbeards (Durin's Folk)",
    },
  ],
  [
    'c-thorin',
    {
      kind: 'Dwarf',
      id: 'c-thorin',
      name: 'Thorin Oakenshield',
      raceId: 'r-dwarf',
      factionIds: ['f-thorin-company'],
      clan: "Longbeards (Durin's Folk)",
    },
  ],
  [
    'c-balin',
    {
      kind: 'Dwarf',
      id: 'c-balin',
      name: 'Balin',
      raceId: 'r-dwarf',
      factionIds: ['f-thorin-company'],
      clan: "Longbeards (Durin's Folk)",
    },
  ],
  [
    'c-gloin',
    {
      kind: 'Dwarf',
      id: 'c-gloin',
      name: 'Glóin',
      raceId: 'r-dwarf',
      factionIds: ['f-thorin-company'],
      clan: "Longbeards (Durin's Folk)",
    },
  ],

  // Wizards (Istari)
  [
    'c-gandalf',
    {
      kind: 'Wizard',
      id: 'c-gandalf',
      name: 'Gandalf',
      raceId: 'r-wizard',
      factionIds: ['f-fellowship', 'f-white-council'],
      order: 'Istari',
      color: 'Grey, later White',
    },
  ],
  [
    'c-saruman',
    {
      kind: 'Wizard',
      id: 'c-saruman',
      name: 'Saruman',
      raceId: 'r-wizard',
      factionIds: ['f-white-council'],
      order: 'Istari',
      color: 'White, later Many-Coloured',
    },
  ],
  [
    'c-radagast',
    {
      kind: 'Wizard',
      id: 'c-radagast',
      name: 'Radagast',
      raceId: 'r-wizard',
      factionIds: ['f-white-council'],
      order: 'Istari',
      color: 'Brown',
    },
  ],

  // Orcs
  [
    'c-ugluk',
    {
      kind: 'Orc',
      id: 'c-ugluk',
      name: 'Uglúk',
      raceId: 'r-orc',
      factionIds: ['f-saruman-army'],
      subtype: 'Uruk-hai',
      overlordName: 'Saruman',
    },
  ],
  [
    'c-grishnakh',
    {
      kind: 'Orc',
      id: 'c-grishnakh',
      name: 'Grishnákh',
      raceId: 'r-orc',
      factionIds: ['f-sauron-army'],
      subtype: 'Orc',
      overlordName: 'Sauron',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Factions
// ---------------------------------------------------------------------------

export interface IFaction {
  id: string;
  name: string;
  alignment: 'Good' | 'Evil' | 'Neutral';
  leaderName: string;
  /** Optional reference to a Character record (when one exists in our dataset). */
  leaderId?: string;
}

export const Factions = new Map<string, IFaction>([
  [
    'f-fellowship',
    {
      id: 'f-fellowship',
      name: 'The Fellowship of the Ring',
      alignment: 'Good',
      leaderName: 'Gandalf',
      leaderId: 'c-gandalf',
    },
  ],
  [
    'f-white-council',
    {
      id: 'f-white-council',
      name: 'The White Council',
      alignment: 'Good',
      leaderName: 'Saruman',
      leaderId: 'c-saruman',
    },
  ],
  [
    'f-rohan',
    {
      id: 'f-rohan',
      name: 'Riders of Rohan',
      alignment: 'Good',
      leaderName: 'Théoden',
      leaderId: 'c-theoden',
    },
  ],
  [
    'f-gondor-army',
    {
      id: 'f-gondor-army',
      name: 'Army of Gondor',
      alignment: 'Good',
      leaderName: 'Denethor II',
      leaderId: 'c-denethor',
    },
  ],
  [
    'f-thorin-company',
    {
      id: 'f-thorin-company',
      name: "Thorin's Company",
      alignment: 'Good',
      leaderName: 'Thorin Oakenshield',
      leaderId: 'c-thorin',
    },
  ],
  [
    'f-saruman-army',
    {
      id: 'f-saruman-army',
      name: "Saruman's Army",
      alignment: 'Evil',
      leaderName: 'Saruman',
      leaderId: 'c-saruman',
    },
  ],
  [
    'f-sauron-army',
    { id: 'f-sauron-army', name: 'Army of Sauron', alignment: 'Evil', leaderName: 'Sauron' },
  ],
]);

// ---------------------------------------------------------------------------
// Battles
// ---------------------------------------------------------------------------

export interface IBattle {
  id: string;
  name: string;
  locationId: string;
  thirdAgeYear: number;
  /** Character ids of named participants present in this dataset. */
  participantIds: string[];
  /** Factions involved. */
  factionIds: string[];
  outcome: string;
}

export const Battles = new Map<string, IBattle>([
  [
    'b-five-armies',
    {
      id: 'b-five-armies',
      name: 'Battle of the Five Armies',
      locationId: 'l-erebor',
      thirdAgeYear: 2941,
      participantIds: ['c-thorin', 'c-balin', 'c-gloin', 'c-bilbo', 'c-gandalf'],
      factionIds: ['f-thorin-company'],
      outcome: 'Pyrrhic victory; Thorin slain.',
    },
  ],
  [
    'b-moria',
    {
      id: 'b-moria',
      name: 'Skirmish at the Bridge of Khazad-dûm',
      locationId: 'l-moria',
      thirdAgeYear: 3019,
      participantIds: [
        'c-gandalf',
        'c-frodo',
        'c-sam',
        'c-aragorn',
        'c-boromir',
        'c-legolas',
        'c-gimli',
        'c-merry',
        'c-pippin',
      ],
      factionIds: ['f-fellowship'],
      outcome: 'Gandalf falls with the Balrog; the Fellowship escapes.',
    },
  ],
  [
    'b-helms-deep',
    {
      id: 'b-helms-deep',
      name: "Battle of Helm's Deep",
      locationId: 'l-helms-deep',
      thirdAgeYear: 3019,
      participantIds: ['c-theoden', 'c-eomer', 'c-aragorn', 'c-legolas', 'c-gimli', 'c-gandalf'],
      factionIds: ['f-rohan', 'f-saruman-army'],
      outcome: "Rohan and allies victorious; Saruman's army destroyed.",
    },
  ],
  [
    'b-pelennor',
    {
      id: 'b-pelennor',
      name: 'Battle of the Pelennor Fields',
      locationId: 'l-minas-tirith',
      thirdAgeYear: 3019,
      participantIds: [
        'c-aragorn',
        'c-gandalf',
        'c-eowyn',
        'c-merry',
        'c-theoden',
        'c-eomer',
        'c-pippin',
        'c-faramir',
      ],
      factionIds: ['f-gondor-army', 'f-rohan', 'f-sauron-army'],
      outcome: "Sauron's army routed; Théoden slain; Witch-king slain by Éowyn.",
    },
  ],
  [
    'b-morannon',
    {
      id: 'b-morannon',
      name: 'Battle of the Morannon',
      locationId: 'l-mordor',
      thirdAgeYear: 3019,
      participantIds: ['c-aragorn', 'c-gandalf', 'c-eomer', 'c-legolas', 'c-gimli', 'c-pippin'],
      factionIds: ['f-gondor-army', 'f-rohan', 'f-sauron-army'],
      outcome: 'Diversion succeeds; the One Ring is destroyed at Mount Doom.',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Books, chapters, quotes
// ---------------------------------------------------------------------------

export interface IBook {
  id: string;
  title: string;
  publishedYear: number;
}

export interface IChapter {
  id: string;
  bookId: string;
  number: number;
  title: string;
}

export interface IQuote {
  id: string;
  text: string;
  /** The character who said it, if attributable. */
  characterId?: string;
  /** The chapter it appears in, if known. */
  chapterId?: string;
}

export const Books = new Map<string, IBook>([
  ['bk-hobbit', { id: 'bk-hobbit', title: 'The Hobbit', publishedYear: 1937 }],
  ['bk-fotr', { id: 'bk-fotr', title: 'The Fellowship of the Ring', publishedYear: 1954 }],
  ['bk-tt', { id: 'bk-tt', title: 'The Two Towers', publishedYear: 1954 }],
  ['bk-rotk', { id: 'bk-rotk', title: 'The Return of the King', publishedYear: 1955 }],
]);

export const Chapters = new Map<string, IChapter>([
  [
    'ch-hobbit-1',
    { id: 'ch-hobbit-1', bookId: 'bk-hobbit', number: 1, title: 'An Unexpected Party' },
  ],
  [
    'ch-hobbit-5',
    { id: 'ch-hobbit-5', bookId: 'bk-hobbit', number: 5, title: 'Riddles in the Dark' },
  ],
  ['ch-fotr-1', { id: 'ch-fotr-1', bookId: 'bk-fotr', number: 1, title: 'A Long-expected Party' }],
  ['ch-fotr-2', { id: 'ch-fotr-2', bookId: 'bk-fotr', number: 2, title: 'The Shadow of the Past' }],
  [
    'ch-fotr-bridge',
    { id: 'ch-fotr-bridge', bookId: 'bk-fotr', number: 5, title: 'The Bridge of Khazad-dûm' },
  ],
  ['ch-tt-helms', { id: 'ch-tt-helms', bookId: 'bk-tt', number: 7, title: "Helm's Deep" }],
  [
    'ch-rotk-pelennor',
    {
      id: 'ch-rotk-pelennor',
      bookId: 'bk-rotk',
      number: 6,
      title: 'The Battle of the Pelennor Fields',
    },
  ],
  [
    'ch-rotk-mount-doom',
    { id: 'ch-rotk-mount-doom', bookId: 'bk-rotk', number: 3, title: 'Mount Doom' },
  ],
]);

export const Quotes = new Map<string, IQuote>([
  [
    'q-1',
    {
      id: 'q-1',
      text: 'All we have to decide is what to do with the time that is given us.',
      characterId: 'c-gandalf',
      chapterId: 'ch-fotr-2',
    },
  ],
  [
    'q-2',
    {
      id: 'q-2',
      text: 'You shall not pass!',
      characterId: 'c-gandalf',
      chapterId: 'ch-fotr-bridge',
    },
  ],
  [
    'q-3',
    {
      id: 'q-3',
      text: 'I am no man.',
      characterId: 'c-eowyn',
      chapterId: 'ch-rotk-pelennor',
    },
  ],
  [
    'q-4',
    {
      id: 'q-4',
      text: "I can't carry it for you, Mr. Frodo, but I can carry you!",
      characterId: 'c-sam',
      chapterId: 'ch-rotk-mount-doom',
    },
  ],
  [
    'q-5',
    {
      id: 'q-5',
      text: 'Not all those who wander are lost.',
      characterId: 'c-bilbo',
    },
  ],
  [
    'q-6',
    {
      id: 'q-6',
      text: 'In a hole in the ground there lived a hobbit.',
      chapterId: 'ch-hobbit-1',
    },
  ],
  [
    'q-7',
    {
      id: 'q-7',
      text: 'One does not simply walk into Mordor.',
      characterId: 'c-boromir',
    },
  ],
  [
    'q-8',
    {
      id: 'q-8',
      text: 'I will take the Ring, though I do not know the way.',
      characterId: 'c-frodo',
    },
  ],
  [
    'q-9',
    {
      id: 'q-9',
      text: 'Even the smallest person can change the course of the future.',
      characterId: 'c-galadriel',
    },
  ],
  [
    'q-10',
    {
      id: 'q-10',
      text: 'Speak friend, and enter.',
      chapterId: 'ch-fotr-bridge',
    },
  ],
]);

// ---------------------------------------------------------------------------
// Lookup helpers
// ---------------------------------------------------------------------------

export function chaptersForBook(bookId: string): IChapter[] {
  return [...Chapters.values()]
    .filter((ch) => ch.bookId === bookId)
    .sort((a, b) => a.number - b.number);
}

export function quotesForChapter(chapterId: string): IQuote[] {
  return [...Quotes.values()].filter((q) => q.chapterId === chapterId);
}
