/**
 * Lightweight server-side helpers for the public GitHub data shown on
 * the sponsors / contributors page. Both calls happen at request time
 * with Next.js's data-cache so the page rebuilds itself in the
 * background once a day; if GitHub is rate-limiting or down, the
 * helpers return an empty list rather than failing the build.
 */

const REPO = 'hayes/pothos';
const SPONSOR_USER = 'hayes';

export interface Contributor {
  login: string;
  avatarUrl: string;
  htmlUrl: string;
  contributions: number;
}

export interface Sponsor {
  login: string;
  name?: string;
  avatarUrl: string;
  htmlUrl: string;
}

interface GitHubContributor {
  login: string;
  avatar_url: string;
  html_url: string;
  contributions: number;
  type: 'User' | 'Bot' | 'Organization';
}

const REVALIDATE_SECONDS = 60 * 60 * 24; // once a day

const COMMON_HEADERS: HeadersInit = {
  Accept: 'application/vnd.github+json',
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'pothos-website',
};

function authHeaders(): HeadersInit {
  const token = process.env.GITHUB_TOKEN;
  return token ? { ...COMMON_HEADERS, Authorization: `Bearer ${token}` } : COMMON_HEADERS;
}

/**
 * Public REST endpoint — no auth required, but rate-limited to 60/hr
 * per IP. With GITHUB_TOKEN set we get 5000/hr.
 */
export async function fetchContributors(): Promise<Contributor[]> {
  // GitHub's REST endpoint pages at 100 contributors. Walk a few pages
  // until either we get back fewer than the per_page max (the last
  // page) or we hit a sane upper bound — the project has hundreds of
  // contributors and we want all of them visible on the page.
  const MAX_PAGES = 5;
  const PER_PAGE = 100;
  const out: Contributor[] = [];
  try {
    for (let page = 1; page <= MAX_PAGES; page++) {
      const res = await fetch(
        `https://api.github.com/repos/${REPO}/contributors?per_page=${PER_PAGE}&page=${page}`,
        {
          headers: authHeaders(),
          next: { revalidate: REVALIDATE_SECONDS, tags: ['github-contributors'] },
        },
      );
      if (!res.ok) break;
      const data = (await res.json()) as GitHubContributor[];
      for (const c of data) {
        if (c.type === 'User') {
          out.push({
            login: c.login,
            avatarUrl: c.avatar_url,
            htmlUrl: c.html_url,
            contributions: c.contributions,
          });
        }
      }
      if (data.length < PER_PAGE) break;
    }
    return out;
  } catch {
    return out;
  }
}

/**
 * Fetch GitHub Sponsors via the GraphQL API. Requires GITHUB_TOKEN with
 * `read:user` scope; returns an empty list otherwise so the curated
 * top-tier sponsors render alone.
 */
export async function fetchSponsors(): Promise<Sponsor[]> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) return [];
  try {
    const res = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        ...authHeaders(),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: `
          query Sponsors($login: String!) {
            user(login: $login) {
              sponsors(first: 100) {
                nodes {
                  ... on User { login name avatarUrl url }
                  ... on Organization { login name avatarUrl url }
                }
              }
            }
          }
        `,
        variables: { login: SPONSOR_USER },
      }),
      next: { revalidate: REVALIDATE_SECONDS, tags: ['github-sponsors'] },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      data?: {
        user?: { sponsors?: { nodes?: { login: string; name?: string; avatarUrl: string; url: string }[] } };
      };
    };
    const nodes = json.data?.user?.sponsors?.nodes ?? [];
    return nodes.map((n) => ({
      login: n.login,
      name: n.name ?? undefined,
      avatarUrl: n.avatarUrl,
      htmlUrl: n.url,
    }));
  } catch {
    return [];
  }
}
