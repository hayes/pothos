import { MDXFile } from '../util/build-nav';

export interface DocsSection {
  heading: string;
  link: string;
  html: string;
  md: string;
  text: string;
}

export type DocsIndex = MDXFile & { sections: DocsSection[]; md: string; html: string };

export enum SearchMatchKind {
  Title,
  Description,
  Heading,
  Content,
}

export interface SearchMatch {
  kind: SearchMatchKind;
  section?: DocsSection;
}

export interface SearchResult {
  matches: SearchMatch[];
  doc: DocsIndex;
}

export class SearchMatcher {
  query;

  results: SearchResult[] = [];

  titleMatches = new Set();
  descriptionMatches = new Set();
  headingMatches = new Map<string, number>();
  contentMatches = new Map<string, number>();

  constructor(query: string) {
    this.query = query;
  }

  matchDoc(doc: DocsIndex) {
    const matches: SearchMatch[] = [];
    this.headingMatches.set(doc.link, 0);
    this.contentMatches.set(doc.link, 0);

    if (this.matches(doc.name)) {
      this.titleMatches.add(doc.link);
      matches.push({ kind: SearchMatchKind.Title });
    } else if (this.matches(doc.description)) {
      this.descriptionMatches.add(doc.link);
      matches.push({ kind: SearchMatchKind.Description });
    }

    doc.sections.forEach((section) => {
      if (this.matches(section.heading)) {
        this.headingMatches.set(doc.link, this.headingMatches.get(doc.link)! + 1);
        matches.push({ kind: SearchMatchKind.Heading, section });
      } else if (this.matches(section.text)) {
        this.contentMatches.set(doc.link, this.contentMatches.get(doc.link)! + 1);
        matches.push({ kind: SearchMatchKind.Content, section });
      }
    });

    if (matches.length > 0) {
      this.results.push({
        doc,
        matches,
      });
    }
  }

  // eslint-disable-next-line no-magic-numbers
  getResults(length: number = 10, matches = 5) {
    return sortByCounts(this.results, (res) => [
      this.titleMatches.has(res.doc.link) ? 1 : 0,
      this.descriptionMatches.has(res.doc.link) ? 1 : 0,
      this.headingMatches.get(res.doc.link) ?? 0,
      this.contentMatches.get(res.doc.link) ?? 0,
    ])
      .slice(0, length)
      .map((res) => ({ ...res, matches: res.matches.slice(0, matches) }));
  }

  matchDocs(docs: DocsIndex[]) {
    docs.forEach((doc) => void this.matchDoc(doc));

    return this;
  }

  matches(base: string) {
    return base.toLocaleLowerCase().includes(this.query.toLocaleLowerCase());
  }
}

function sortByCounts<T>(list: T[], getCounts: (val: T) => number[]) {
  return list
    .map((item) => ({ counts: getCounts(item), val: item }))
    .sort((a, b) => {
      const l = Math.max(a.counts.length, b.counts.length);

      for (let i = 0; i < l; i += 1) {
        if (a.counts[i] === b.counts[i]) {
          // eslint-disable-next-line no-continue
          continue;
        }
        if (b.counts[i] === undefined) {
          return -1;
        }

        if (a.counts[i] === undefined) {
          return 1;
        }

        return b.counts[i] - a.counts[i];
      }

      return 0;
    })
    .map(({ val }) => val);
}
