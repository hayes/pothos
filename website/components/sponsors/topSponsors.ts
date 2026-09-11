/**
 * Curated top-tier sponsors — these stay hardcoded so the layout has
 * stable hero cards for the most-prominent supporters. Below this
 * list the page falls back to GitHub Sponsors data.
 */

export interface TopSponsor {
  name: string;
  logo: string;
  href: string;
  /** Short blurb for the card. */
  blurb?: string;
}

export const TOP_SPONSORS: TopSponsor[] = [
  {
    name: 'The Guild',
    logo: 'https://pothos-graphql.dev/assets/the-guild-logo.svg',
    href: 'https://www.the-guild.dev/',
    blurb: 'GraphQL infrastructure and tooling',
  },
  {
    name: 'Prisma',
    logo: 'https://pothos-graphql.dev/assets/prisma-logo.svg',
    href: 'https://www.prisma.io/',
    blurb: 'Next-generation TypeScript ORM',
  },
  {
    name: 'GitHub',
    logo: 'https://pothos-graphql.dev/assets/github-logo.svg',
    href: 'https://github.com/hayes/pothos',
    blurb: 'Where the code lives',
  },
  {
    name: 'Stellate',
    logo: 'https://pothos-graphql.dev/assets/stellate-logo.svg',
    href: 'https://stellate.co/',
    blurb: 'Edge caching for GraphQL APIs',
  },
];

/**
 * GitHub handles known to sponsor the project — used as a fallback
 * when the GraphQL API isn't reachable (no `GITHUB_TOKEN` set, or rate
 * limited). Maintained from the project's existing sponsors list.
 */
export const FALLBACK_SPONSOR_LOGINS: string[] = [
  'saevarb',
  'seanaye',
  'arimgibson',
  'ccfiel',
  'JoviDeCroock',
  'hellopivot',
  'robmcguinness',
  'Gomah',
  'IPS-Hosting',
  'garth',
  'lifedup',
  'skworden',
  'jacobgmathew',
  'aniravi24',
  'mizdra',
  '3nk1du',
  'FarazPatankar',
  'noxify',
  'matthawk60',
  'BitPhinix',
  'nathanchapman',
  'pradyuman',
  'tmm',
];
