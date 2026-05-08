/**
 * Lightweight server-side helpers for the public GitHub data shown on
 * the sponsors / contributors page. Both calls happen at request time
 * with Next.js's data-cache so the page rebuilds itself in the
 * background once a day; if GitHub is rate-limiting or down, the
 * helpers return an empty list rather than failing the build.
 */

// GitHub repo and sponsorship account that back this site's data.
// Exported so UI components can build links without re-hardcoding the
// strings.
export const REPO = 'hayes/pothos';
export const SPONSOR_USER = 'hayes';
export const REPO_URL = `https://github.com/${REPO}`;
export const SPONSOR_URL = `https://github.com/sponsors/${SPONSOR_USER}`;

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

/**
 * Provenance flag returned alongside every public github fetch. UI
 * doesn't have to render differently for each value today, but the
 * distinction is useful for telemetry: 'fallback' means the call
 * intentionally returned an empty list (no token configured), whereas
 * 'error' means the API returned a non-OK response or threw.
 */
export type GithubDataSource = 'live' | 'fallback' | 'error';

export interface SponsorsResult {
  data: Sponsor[];
  source: GithubDataSource;
}

export interface ContributorsResult {
  data: Contributor[];
  source: GithubDataSource;
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
 *
 * Pagination policy: if a non-first page fails (rate limit, 5xx) we
 * return an empty list rather than a half-paginated one — silently
 * truncating contributors is worse than rendering nothing.
 */
export async function fetchContributors(): Promise<ContributorsResult> {
  // GitHub's REST endpoint pages at 100 contributors. Walk up to
  // MAX_PAGES (= 1000 contributors) before giving up; this project has
  // hundreds of contributors and we want all of them visible.
  const MAX_PAGES = 10;
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
      if (!res.ok) {
        if (page === 1) {
          // No data yet — surface as an error.
          return { data: [], source: 'error' };
        }
        // We already have a partial set. Returning it would silently
        // truncate the list, which looks indistinguishable from a clean
        // result. Better to render nothing and surface the failure.
        console.warn(
          `[github] fetchContributors: page ${page} returned ${res.status}; discarding ${out.length} partial results`,
        );
        return { data: [], source: 'error' };
      }
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
      if (data.length < PER_PAGE) {
        return { data: out, source: 'live' };
      }
      if (page === MAX_PAGES && data.length === PER_PAGE) {
        console.warn(
          `[github] fetchContributors: hit MAX_PAGES=${MAX_PAGES}; there may be more contributors than rendered`,
        );
      }
    }
    return { data: out, source: 'live' };
  } catch (err) {
    console.warn('[github] fetchContributors threw:', err);
    return { data: [], source: 'error' };
  }
}

/**
 * Fetch GitHub Sponsors via the GraphQL API. Requires GITHUB_TOKEN with
 * `read:user` scope; returns source='fallback' otherwise so the caller
 * can render a curated list. A non-OK response or thrown error returns
 * source='error' — distinguishable from the no-token case.
 */
export async function fetchSponsors(): Promise<SponsorsResult> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return { data: [], source: 'fallback' };
  }
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
    if (!res.ok) {
      console.warn(`[github] fetchSponsors: ${res.status}`);
      return { data: [], source: 'error' };
    }
    const json = (await res.json()) as {
      data?: {
        user?: {
          sponsors?: { nodes?: { login: string; name?: string; avatarUrl: string; url: string }[] };
        };
      };
    };
    const nodes = json.data?.user?.sponsors?.nodes ?? [];
    const data = nodes.map((n) => ({
      login: n.login,
      name: n.name ?? undefined,
      avatarUrl: n.avatarUrl,
      htmlUrl: n.url,
    }));
    return { data, source: 'live' };
  } catch (err) {
    console.warn('[github] fetchSponsors threw:', err);
    return { data: [], source: 'error' };
  }
}
